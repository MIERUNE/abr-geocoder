FROM node:20-bookworm-slim

# Lambda WebAdapter
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.3 /lambda-adapter /opt/extensions/lambda-adapter
ENV PORT=8787
ENV READINESS_CHECK_PATH=/health

WORKDIR /app

ENV ABRG_DATADIR=/abrgdata

COPY package.json /app/package.json
COPY tsconfig.json /app/tsconfig.json
COPY tsconfig.build.json /app/tsconfig.build.json
COPY src /app/src
COPY schema.sql /app/schema.sql

RUN npm install
RUN npm run build

# donwload address data: it takes a while, 500sec
RUN node /app/build/cli/cli.js download --dataDir ${ABRG_DATADIR}

CMD ["node", "build/server/index.js"]