FROM ubuntu:18.04 as base

ENV DEBIAN_FRONTEND noninteractive
ENV NODE_VERSION "v12.18.1"

# Lots of packages. Some dependencies and a lot of stuf for GUI.
RUN apt-get -qq -y update && \
    apt-get -qq -y install npm gcc g++ git libusb-1.0 libxcomposite-dev \
    libxcursor-dev make libavutil-dev libsecret-1-dev libudev-dev curl sudo zsh \
    libx11-dev gconf-service libasound2 libatk1.0-0 libatk-bridge2.0-0 libc6 libcairo2 \
    libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 \
    libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 \
    libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 \
    libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release \
    xdg-utils wget libcanberra-gtk-module libcanberra-gtk3-module packagekit-gtk3-module sudo chromium-browser

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

RUN sudo chown -R node:$(id -gn node) /home/node/.config

WORKDIR /home/node

RUN mkdir uploader 

ENV NODE_ENV "development"

WORKDIR /home/node/uploader/

COPY entrypoint.sh entrypoint.sh

USER node

ENTRYPOINT ["/bin/bash", "entrypoint.sh"]
