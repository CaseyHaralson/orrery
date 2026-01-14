FROM node:24

ARG TZ
ENV TZ="$TZ"

# Install basic development tools and iptables/ipset
RUN apt-get update && apt-get install -y --no-install-recommends \
  less \
  git \
  procps \
  sudo \
  fzf \
  zsh \
  man-db \
  unzip \
  gnupg2 \
  gh \
  iptables \
  ipset \
  iproute2 \
  dnsutils \
  aggregate \
  jq \
  nano \
  vim \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Create vscode user (handle case where GID/UID 1000 already exists from base image)
RUN if getent group 1000 > /dev/null; then \
      groupmod -n vscode $(getent group 1000 | cut -d: -f1); \
    else \
      groupadd --gid 1000 vscode; \
    fi && \
    if getent passwd 1000 > /dev/null; then \
      usermod -l vscode -d /home/vscode -m -s /bin/zsh $(getent passwd 1000 | cut -d: -f1); \
    else \
      useradd --uid 1000 --gid vscode --shell /bin/zsh --create-home vscode; \
    fi && \
    echo "vscode ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/vscode && \
    chmod 0440 /etc/sudoers.d/vscode

# Ensure vscode user has access to /usr/local/share
RUN mkdir -p /usr/local/share/npm-global && \
  chown -R vscode:vscode /usr/local/share

ARG USERNAME=vscode

# Persist bash history.
RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  && mkdir /commandhistory \
  && touch /commandhistory/.bash_history \
  && chown -R $USERNAME /commandhistory

# Set `DEVCONTAINER` environment variable to help with orientation
ENV DEVCONTAINER=true

# Create workspace and config directories and set permissions
RUN mkdir -p /workspace /home/vscode/.claude  /home/vscode/.codex /home/vscode/.gemini && \
  chown -R vscode:vscode /workspace /home/vscode/.claude /home/vscode/.codex /home/vscode/.gemini

WORKDIR /workspace

ARG GIT_DELTA_VERSION=0.18.2
RUN ARCH=$(dpkg --print-architecture) && \
  wget "https://github.com/dandavison/delta/releases/download/${GIT_DELTA_VERSION}/git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
  sudo dpkg -i "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
  rm "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb"

# Set up non-root user
USER vscode

# Install global packages
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin

# Set the default shell to zsh rather than sh
ENV SHELL=/bin/zsh

# Set the default editor and visual
ENV EDITOR=nano
ENV VISUAL=nano

# Default powerline10k theme
ARG ZSH_IN_DOCKER_VERSION=1.2.0
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v${ZSH_IN_DOCKER_VERSION}/zsh-in-docker.sh)" -- \
  -p git \
  -p fzf \
  -a "source /usr/share/doc/fzf/examples/key-bindings.zsh" \
  -a "source /usr/share/doc/fzf/examples/completion.zsh" \
  -a "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  -x

ARG CLAUDE_CODE_VERSION=latest
ARG CODEX_VERSION=latest
ARG GEMINI_VERSION=latest

# Install Claude
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}

# Install Codex
RUN npm install -g @openai/codex@${CODEX_VERSION}

# Install Gemini
RUN npm install -g @google/gemini-cli@${GEMINI_VERSION}


# Copy and set up firewall script
COPY init-firewall.sh /usr/local/bin/
USER root
RUN chmod +x /usr/local/bin/init-firewall.sh && \
  echo "vscode ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/vscode-firewall && \
  chmod 0440 /etc/sudoers.d/vscode-firewall
USER vscode
