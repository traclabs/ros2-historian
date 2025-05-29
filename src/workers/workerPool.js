import { Worker, MessageChannel } from 'node:worker_threads';
import os from 'node:os';
import { config } from '../server.js';

const POOL_SIZE =
  config.poolSize ?? Math.max(1, (os.availableParallelism?.() || os.cpus().length) - 1);

class Pool {
  constructor() {
    this.idle = [];
    this.queue = [];
    this.workers = new Set();
    this.counter = 0; // task id
    for (let i = 0; i < POOL_SIZE; i++) this.spawn();
  }

  spawn() {
    const worker = new Worker(new URL('./rangeWorker.js', import.meta.url), {
      resourceLimits: { maxOldGenerationSizeMb: 256 }
    });
    this.workers.add(worker);
    worker.on('message', (msg) => this.onMessage(worker, msg));
    worker.on('exit', () => this.onExit(worker));
    worker.on('error', (err) => {
      /* eslint-disable no-console */
      console.error('Worker error:', err);
      /* eslint-enable no-console */
    });
    this.idle.push(worker);
    this.dequeue();
  }

  onExit(worker) {
    this.workers.delete(worker);
    // replace exited worker
    this.spawn();
  }

  onMessage(worker, msg) {
    const { done, id, error, ready } = msg;
    const task = this.inFlight?.get(id);
    if (!task) return;

    if (ready) {
      // first ack → resolve port transfer
      task.resolve(msg.port);
    } else if (error) {
      task.reject(new Error(error));
    } else if (done) {
      this.inFlight.delete(id);
      this.idle.push(worker);
      this.dequeue();
    }
  }

  async schedule(params) {
    if (!this.inFlight) this.inFlight = new Map();

    const id = ++this.counter;
    const taskPromise = new Promise((resolve, reject) => {
      this.queue.push({ id, params, resolve, reject });
    });

    this.dequeue();
    return taskPromise;
  }

  dequeue() {
    if (!this.idle.length || !this.queue.length) return;
    const worker = this.idle.pop();
    const { id, params } = this.queue.shift();

    const { port1, port2 } = new MessageChannel();
    this.inFlight.set(id, { resolve: null, reject: null });

    worker.postMessage({ id, params, port: port2 }, [port2]);
    // Save resolve/reject for later
    this.inFlight.get(id).resolve = (p) => {
      // parent lets caller stream from port1
      this.inFlight.get(id).started = true;
      this.inFlight.get(id).resolve = null; // free
      this.queuePortResolve(id, p);
    };
    this.inFlight.get(id).reject = this.queuePortReject.bind(this, id);
    this.inFlight.get(id).port1 = port1;
  }

  queuePortResolve(id, port) {
    const task = this.inFlight.get(id);
    if (task && task.started) {
      task.port1.on('close', () => {
        // mark done manually if client closes early
        this.inFlight.delete(id);
        this.idle.push(task.worker);
        this.dequeue();
      });
      task.resolve(port);
    }
  }

  queuePortReject(id, err) {
    const task = this.inFlight.get(id);
    if (task) {
      task.reject(err);
      this.inFlight.delete(id);
      this.idle.push(task.worker);
      this.dequeue();
    }
  }

  async drain() {
    // Wait for all current tasks to finish
    while (this.inFlight && this.inFlight.size) {
      await new Promise((r) => setTimeout(r, 100));
    }
    // Terminate workers
    await Promise.all([...this.workers].map((w) => w.terminate()));
  }
}

const WorkerPool = new Pool();
export default WorkerPool;
