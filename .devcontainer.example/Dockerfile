FROM mcr.microsoft.com/devcontainers/base:ubuntu-22.04

# ---- Base config ----
ARG TZ=America/Chicago
ENV TZ="${TZ}"
ENV DEVCONTAINER=true

ARG USERNAME=vscode
ENV HOME=/home/${USERNAME}

# Use bash with pipefail for build RUN steps by default (safer than /bin/sh)
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# ---- OS packages ----
RUN apt-get update \
  && export DEBIAN_FRONTEND=noninteractive \
  && apt-get -y install --no-install-recommends \
    ca-certificates \
    curl \
    dnsutils \
    fzf \
    gh \
    git \
    gnupg2 \
    iproute2 \
    ipset \
    iptables \
    jq \
    less \
    man-db \
    nano \
    procps \
    sudo \
    unzip \
    vim \
    wget \
    zsh \
    aggregate \
  && apt-get autoremove -y \
  && apt-get clean -y \
  && rm -rf /var/lib/apt/lists/*

# ---- Workspace + config dirs + persistent history ----
RUN mkdir -p /workspace \
    /commandhistory \
    "${HOME}/.claude" \
    "${HOME}/.codex" \
    "${HOME}/.gemini" \
  && touch /commandhistory/.bash_history \
  && chown -R "${USERNAME}:${USERNAME}" \
    /workspace \
    /commandhistory \
    "${HOME}/.claude" \
    "${HOME}/.codex" \
    "${HOME}/.gemini"

# Persist bash history (devcontainer orientation)
RUN echo "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
    > /etc/profile.d/00-devcontainer-history.sh \
  && chmod 0644 /etc/profile.d/00-devcontainer-history.sh

# ---- git-delta ----
ARG GIT_DELTA_VERSION=0.18.2
RUN ARCH="$(dpkg --print-architecture)" \
  && wget -q "https://github.com/dandavison/delta/releases/download/${GIT_DELTA_VERSION}/git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" \
  && dpkg -i "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" \
  && rm -f "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb"

# ---- Switch to vscode user for user-scoped tool installs ----
USER ${USERNAME}

# Use bash -lc for nvm-driven commands (nvm.sh expects bash-ish behavior)
SHELL ["/bin/bash", "-lc"]

# ---- nvm + Node LTS ----
ARG NVM_VERSION=v0.39.7
RUN curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash \
  && export NVM_DIR="$HOME/.nvm" \
  && source "$NVM_DIR/nvm.sh" \
  && nvm install --lts \
  && nvm alias default lts/* \
  && nvm use default \
  && npm --version \
  && node --version

# Make nvm available in interactive shells (bash + zsh)
RUN echo 'export NVM_DIR="$HOME/.nvm"' >> "${HOME}/.bashrc" \
  && echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> "${HOME}/.bashrc" \
  && echo '[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"' >> "${HOME}/.bashrc" \
  && echo 'export NVM_DIR="$HOME/.nvm"' >> "${HOME}/.zshrc" \
  && echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> "${HOME}/.zshrc" \
  && echo '[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"' >> "${HOME}/.zshrc"

# ---- uv ----
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

# Ensure uv is on PATH for vscode user
ENV PATH="${HOME}/.cargo/bin:${PATH}"

# ---- zsh + powerlevel10k (zsh-in-docker) ----
ARG ZSH_IN_DOCKER_VERSION=1.2.0
RUN sh -c "$(wget -qO- "https://github.com/deluan/zsh-in-docker/releases/download/v${ZSH_IN_DOCKER_VERSION}/zsh-in-docker.sh")" -- \
  -p git \
  -a "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  -a 'export NVM_DIR="$HOME/.nvm"' \
  -a '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' \
  -a '[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"' \
  -a "setopt nonomatch" \
  -x

# ---- fzf shell integration (manual) ----
RUN mkdir -p "${HOME}/.fzf" \
  && wget -qO "${HOME}/.fzf/key-bindings.zsh" https://raw.githubusercontent.com/junegunn/fzf/master/shell/key-bindings.zsh \
  && wget -qO "${HOME}/.fzf/completion.zsh" https://raw.githubusercontent.com/junegunn/fzf/master/shell/completion.zsh \
  && echo '[ -f ~/.fzf/key-bindings.zsh ] && source ~/.fzf/key-bindings.zsh' >> "${HOME}/.zshrc" \
  && echo '[ -f ~/.fzf/completion.zsh ] && source ~/.fzf/completion.zsh' >> "${HOME}/.zshrc"

# ---- Install CLI tools via npm (Claude, Codex, Gemini) ----
ARG CLAUDE_CODE_VERSION=latest
ARG CODEX_VERSION=latest
ARG GEMINI_VERSION=latest

RUN export NVM_DIR="$HOME/.nvm" \
  && source "$NVM_DIR/nvm.sh" \
  && nvm use default \
  && npm install -g \
      "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
      "@openai/codex@${CODEX_VERSION}" \
      "@google/gemini-cli@${GEMINI_VERSION}"

# ---- Install orrery ----
COPY --chown=vscode:vscode ./*.tgz /tmp/devcontainer/

RUN export NVM_DIR="$HOME/.nvm" \
  && source "$NVM_DIR/nvm.sh" \
  && nvm use default \
  && npm install -g /tmp/devcontainer/*.tgz \
  && rm -rf /tmp/devcontainer

# ---- Back to root for firewall script setup ----
USER root
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

COPY init-firewall.sh /usr/local/bin/init-firewall.sh
RUN chmod +x /usr/local/bin/init-firewall.sh \
  && echo "${USERNAME} ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/${USERNAME}-firewall \
  && chmod 0440 /etc/sudoers.d/${USERNAME}-firewall

# ---- Defaults ----
WORKDIR /workspace
USER ${USERNAME}

# Keep zsh as the default interactive shell
ENV SHELL=/bin/zsh
ENV EDITOR=nano
ENV VISUAL=nano
