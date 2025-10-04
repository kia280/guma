FROM mcr.microsoft.com/devcontainers/go:1.24

# Install Go tools that will be installed by the install-tools script
# Pre-install them here for faster container startup
RUN go install github.com/bufbuild/buf/cmd/buf@latest \
    && go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest \
    && go install google.golang.org/protobuf/cmd/protoc-gen-go@latest \
    && go install connectrpc.com/connect/cmd/protoc-gen-connect-go@latest \
    && go install github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Add vscode user to sudoers with no password
ARG USERNAME=vscode

# Add vscode user as sudoer
RUN echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
&& chmod 0440 /etc/sudoers.d/$USERNAME

# Add vscode user to docker group for Docker-in-Docker
RUN groupadd docker \
    && usermod -aG docker $USERNAME

# Create workspace directory
WORKDIR /workspace

# Set up shell history persistence
# RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
#     && echo $SNIPPET >> "/home/vscode/.bashrc"

# Switch to vscode user
USER $USERNAME
