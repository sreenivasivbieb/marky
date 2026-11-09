# Dev "toolbox" image: Node + pnpm (ADR 0005, 0010, 0015).
# Versions yahan nahi likhe; ye build args versions.env se aate hain (docker-compose.yml dekho).
# Koi default nahi diya gaya: arg missing ho to build fail ho jaayega ("fail fast").

ARG NODE_IMAGE_TAG
FROM node:${NODE_IMAGE_TAG}

ARG PNPM_VERSION
RUN npm install --global "pnpm@${PNPM_VERSION}" \
 && npm cache clean --force

# Container host user ki UID se chalta hai (docker-compose.yml: user), aur wo UID image me exist nahi karti.
# Isliye ek aisa HOME dete hain jisme koi bhi user likh sake (pnpm/node apni settings aur cache HOME me rakhte hain).
ENV HOME=/tmp/home
RUN mkdir -p "$HOME" && chmod 1777 "$HOME"

WORKDIR /workspace
