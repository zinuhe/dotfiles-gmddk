export PATH="$HOME/.local/bin:$PATH"
# The following lines have been added by Docker Desktop to enable Docker CLI completions.
fpath=(/Users/jimmy/.docker/completions $fpath)
autoload -Uz compinit
(( ${+_comps[docker]} )) || compinit
# End of Docker CLI completions

# ----------------------------------------------------------------------
# fzf-tab (must load after compinit, before autosuggestions/syntax-highlighting)
# ----------------------------------------------------------------------
source "/opt/homebrew/opt/fzf-tab/share/fzf-tab/fzf-tab.zsh"


# ----------------------------------------------------------------------
# Aliases
# ----------------------------------------------------------------------
# Borra los alias ya cargados para que "source ~/.zshrc" no deje vivos los que quitaste del archivo
unalias -a
if [ -f ~/dotfiles-gmddk/.aliases ]; then
    . ~/dotfiles-gmddk/.aliases
fi

# ----------------------------------------------------------------------
# Colors
# ----------------------------------------------------------------------
if [ -f ~/dotfiles-gmddk/.colors ]; then
    . ~/dotfiles-gmddk/.colors
fi

# ----------------------------------------------------------------------
# starship
# ----------------------------------------------------------------------
eval "$(starship init zsh)"

# ----------------------------------------------------------------------
# zsh-autosuggestions
# ----------------------------------------------------------------------
source /opt/homebrew/share/zsh-autosuggestions/zsh-autosuggestions.zsh

# ----------------------------------------------------------------------
# zsh-syntax-highlighting (must be the last thing sourced in this file)
# ----------------------------------------------------------------------
source /opt/homebrew/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh
# SSH Agent for tmux - AI Maestro
if [ -S "$SSH_AUTH_SOCK" ] && [ ! -h "$SSH_AUTH_SOCK" ]; then
    mkdir -p ~/.ssh
    ln -sf "$SSH_AUTH_SOCK" ~/.ssh/ssh_auth_sock
fi
