rm -rf dist/bin && \
pkg -o "dist/bin/LFS Ambient Sounds.exe" . && \
cp config.toml public/README.txt dist/bin/ && \
mkdir dist/bin/sounds && \
cp sounds/global_street_ambience.mp3 sounds/SirenSlow.wav sounds/WindExternal.wav dist/bin/sounds/ && \
mkdir dist/bin/tracks && \
cp tracks/LA.toml dist/bin/tracks/