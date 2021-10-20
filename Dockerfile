FROM ubuntu:18.04

ENV DEBIAN_FRONTEND noninteractive
ENV NODE_VERSION "v12.13.0"

# Lots of packages. Some dependencies and stuff for GUI.
RUN apt-get -qq -y update && \
    apt-get -qq -y install build-essential git curl libusb-1.0 libavutil-dev libxss1 \
    libsecret-1-dev libudev-dev libgtk-3-0 libcanberra-gtk3-module packagekit-gtk3-module \
    chromium-browser

RUN useradd -s /bin/bash node && mkdir -p /home/node/.config \
    && chown -R node:node /home/node

# Yarn
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -

RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
RUN apt-get -qq -y update && apt-get -qq -y install yarn

# Node 
RUN curl -O https://nodejs.org/download/release/$NODE_VERSION/node-$NODE_VERSION-linux-x64.tar.gz \
    && tar -xzf node-$NODE_VERSION-linux-x64.tar.gz -C /usr/local/bin

ENV PATH=/usr/local/bin/node-$NODE_VERSION-linux-x64/bin:${PATH}

RUN chown -R node:$(id -gn node) /home/node/.config

WORKDIR /home/node

RUN mkdir uploader 

ENV NODE_ENV "development"

WORKDIR /home/node/uploader/

COPY entrypoint.sh entrypoint.sh

USER node

ENTRYPOINT ["/bin/bash", "entrypoint.sh"]
