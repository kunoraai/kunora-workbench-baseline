$ErrorActionPreference = 'Stop'
docker build -t dshd:m1 .
docker run --rm dshd:m1 --version

