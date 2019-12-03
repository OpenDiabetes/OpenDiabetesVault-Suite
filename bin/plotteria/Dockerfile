FROM alpine:3.10

VOLUME [/plotteria]

RUN mkdir /tmp/plotteria
COPY plot.py config.ini legend-dataset-v10.csv /tmp/plotteria/

RUN apk --update --no-cache add \
	zlib-dev \
	musl-dev \
	libc-dev \
	gcc \
	git \
	pwgen

RUN apk add --no-cache libpng freetype libstdc++ binutils

RUN apk add --no-cache python3 \
    &&     python3 -m ensurepip \
    &&     rm -r /usr/lib/python*/ensurepip \
    &&     pip3 install --upgrade pip setuptools \
    &&     if [ ! -e /usr/bin/pip ]; then ln -s pip3 /usr/bin/pip ; fi \
    &&     if [[ ! -e /usr/bin/python ]]; then ln -sf /usr/bin/python3 /usr/bin/python; fi \
    &&     rm -r /root/.cache

RUN apk add --no-cache --virtual .build-deps build-base python3-dev libpng-dev freetype-dev
RUN ln -s /usr/include/locale.h /usr/include/xlocale.h       \
    && pip install numpy        \
    && pip install matplotlib   \
    && pip install configparser         \
    && pip install iso8601      \
	&& pip install tornado \
    && apk del .build-deps
	
RUN git clone --depth 1 --single-branch --branch v3.4 https://github.com/pyinstaller/pyinstaller.git /tmp/pyinstaller \
    && cd /tmp/pyinstaller/bootloader \
    && CFLAGS="-Wno-stringop-overflow" python ./waf configure --no-lsb all \
    && pip install .. \
    && rm -Rf /tmp/pyinstaller

WORKDIR /tmp/plotteria/
RUN pyinstaller plot.py
RUN ln -s /tmp/plotteria/dist/plot/plot /bin/plot