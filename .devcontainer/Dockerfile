#--------------------------------------------------------------------
# VS Code Development Container for ROS 2 Historian (Node 22 + ROS 2)
#--------------------------------------------------------------------
# Base: official ROS 2 Humble headless image (Ubuntu 22.04)
FROM ros:humble-ros-base

ARG NODE_VERSION=22

# -------------------------------------------------------------------
# Install Node.js 22, build essentials, and optional helpers
# -------------------------------------------------------------------
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl gnupg2 ca-certificates build-essential git && \
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g npm && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# -------------------------------------------------------------------
# Default workdir matches devcontainer workspaceFolder
# -------------------------------------------------------------------
WORKDIR /workspace/ros2-historian

# -------------------------------------------------------------------
# Source ROS 2 environment for every shell
# -------------------------------------------------------------------
RUN echo "source /opt/ros/humble/setup.bash" >> /etc/bash.bashrc

# -------------------------------------------------------------------
# Expose historian port (adjustable via PORT env)
# -------------------------------------------------------------------
EXPOSE 8080

# -------------------------------------------------------------------
# Show versions for quick sanity check
# -------------------------------------------------------------------
RUN node -v && npm -v && printenv ROS_DISTRO
