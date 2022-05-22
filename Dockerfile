FROM --platform=$BUILDPLATFORM node:17.7-alpine3.14 AS client-builder
WORKDIR /ui
# cache packages in layer
COPY ui/package.json /ui/package.json
COPY ui/package-lock.json /ui/package-lock.json
RUN --mount=type=cache,target=/usr/src/app/.npm \
    npm set cache /usr/src/app/.npm && \
    npm ci
# install
COPY ui /ui
RUN npm run build

FROM alpine
LABEL org.opencontainers.image.title="dockerfile-linter" \
    org.opencontainers.image.description="My awesome Docker extension" \
    org.opencontainers.image.vendor="Felipe Cruz" \
    com.docker.desktop.extension.api.version=">= 0.2.3" \
    com.docker.extension.screenshots="" \
    com.docker.extension.detailed-description="This extension aims to help you building best practice Docker images. It uses the Open Source project Hadolint to parse your Dockerfile and retrieve a list of suggestions based on a predefined set of rules to improve your Dockerfile."\
    com.docker.extension.publisher-url="https://github.com/felipecruz91/dockerfile-linter-extension" \
    com.docker.extension.additional-urls='[{"title":"Source code","url":"https://github.com/felipecruz91/dockerfile-linter-extension"}, {"title":"Feedback","url":"https://github.com/felipecruz91/dockerfile-linter-extension/issues"}, {"title":"Author","url":"https://twitter.com/felipecruz"}]' \
    com.docker.extension.changelog=""

COPY metadata.json .
COPY docker.svg .
COPY --from=client-builder /ui/build ui
