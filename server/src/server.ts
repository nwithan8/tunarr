import cors from '@fastify/cors';
import middie from '@fastify/middie';
import fpStatic from '@fastify/static';
import fastify, { FastifySchema } from 'fastify';
import fp from 'fastify-plugin';
// import fastifyPrintRoutes from 'fastify-print-routes';
import fastifyMultipart from '@fastify/multipart';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { RequestContext } from '@mikro-orm/core';
import fastifyPrintRoutes from 'fastify-print-routes';
import {
  ZodTypeProvider,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import fs from 'fs';
import { isArray, isNumber, isString, isUndefined, round } from 'lodash-es';
import schedule from 'node-schedule';
import path, { dirname, join } from 'path';
import { ffmpegSettingsRouter } from './api/ffmpegSettingsApi.js';
import { guideRouter } from './api/guideApi.js';
import { hdhrSettingsRouter } from './api/hdhrSettingsApi.js';
import { hlsApi } from './api/hlsApi.js';
import { apiRouter } from './api/index.js';
import { plexServersRouter } from './api/plexServersApi.js';
import { plexSettingsRouter } from './api/plexSettingsApi.js';
import { videoRouter } from './api/videoApi.js';
import { xmlTvSettingsRouter } from './api/xmltvSettingsApi.js';
import { EntityManager, initOrm } from './dao/dataSource.js';
import { LegacyDbMigrator } from './dao/legacy_migration/legacyDbMigration.js';
import { getSettings } from './dao/settings.js';
import { ServerOptions, serverOptions } from './globals.js';
import { ServerRequestContext, serverContext } from './serverContext.js';
import { GlobalScheduler, scheduleJobs } from './services/scheduler.js';
import { initPersistentStreamCache } from './stream/channelCache.js';
import { runFixers } from './tasks/fixers/index.js';
import { UpdateXmlTvTask } from './tasks/updateXmlTvTask.js';
import { filename, isProduction, run } from './util/index.js';
import { Logger, LoggerFactory } from './util/logging/LoggerFactory.js';

const currentDirectory = dirname(filename(import.meta.url));

async function initDbDirectories(logger: Logger) {
  const opts = serverOptions();
  const hasTunarrDb = fs.existsSync(opts.databaseDirectory);
  const hasLegacyDb = fs.existsSync(path.resolve(process.cwd(), '.dizquetv'));
  if (!hasTunarrDb) {
    logger.debug(`Existing database at ${opts.databaseDirectory} not found`);
    if (hasLegacyDb) {
      logger.info(
        `DB configured at location ${opts.databaseDirectory} was not found, but a legacy .dizquetv database was located. A migration will be attempted`,
      );
    }
    fs.mkdirSync(opts.databaseDirectory);
    await getSettings().flush();
  }

  [['channel-lineups'], ['images'], ['cache'], ['cache', 'images']].forEach(
    (pathParts) => {
      const pathToCheck = path.join(opts.databaseDirectory, ...pathParts);
      if (!fs.existsSync(pathToCheck)) {
        logger.debug(`Creating path at ${pathToCheck}`);
        fs.mkdirSync(pathToCheck);
      }
    },
  );

  // TODO: This will be an option that the user can set...
  if (!fs.existsSync(path.join(process.cwd(), 'streams'))) {
    fs.mkdirSync(path.join(process.cwd(), 'streams'));
  }

  return !hasTunarrDb && hasLegacyDb;
}

export async function initServer(opts: ServerOptions) {
  const settingsDb = getSettings();
  LoggerFactory.initialize(settingsDb);

  const logger = LoggerFactory.child({ caller: import.meta });

  const hadLegacyDb = await initDbDirectories(logger);

  const orm = await initOrm();

  const ctx = serverContext();

  if (
    hadLegacyDb &&
    (ctx.settings.needsLegacyMigration() || opts.force_migration)
  ) {
    logger.info('Migrating from legacy database folder...');
    await new LegacyDbMigrator().migrateFromLegacyDb(settingsDb).catch((e) => {
      logger.error('Failed to migrate from legacy DB: %O', e);
    });
  } else if (ctx.settings.needsLegacyMigration()) {
    // Mark the settings as if we migrated, even when there were no
    // legacy settings present. This will prevent us from trying
    // again on subsequent runs
    await ctx.settings.updateBaseSettings('migration', {
      legacyMigration: true,
    });
  }

  scheduleJobs(ctx);
  await runFixers();
  await initPersistentStreamCache();

  const updateXMLPromise = GlobalScheduler.getScheduledJob(
    UpdateXmlTvTask.ID,
  ).runNow();

  const app = fastify({
    logger: false,
    bodyLimit: 50 * 1024 * 1024,
  })
    .setValidatorCompiler(validatorCompiler)
    .setSerializerCompiler(serializerCompiler)
    .withTypeProvider<ZodTypeProvider>();

  if (serverOptions().printRoutes) {
    await app.register(fastifyPrintRoutes);
  }

  await app
    .decorateRequest('disableRequestLogging', false)
    .decorateRequest('logRequestAtLevel', 'http')
    .register(fastifySwagger, {
      openapi: {
        info: {
          title: 'Tunarr',
          description: 'Tunarr API',
          version: '1.0.0',
        },
        servers: [],
        tags: [
          {
            name: 'Channels',
          },
        ],
      },
      transform: jsonSchemaTransform,
    })
    .register(fastifySwaggerUi, {
      routePrefix: '/docs',
      baseDir:
        isProduction && process.argv.length > 1
          ? join(dirname(process.argv[1]), 'static')
          : undefined,
    })
    .register(middie)
    .register(cors, {
      origin: '*', // Testing
    })
    .register(fastifyMultipart)
    .addHook('onRequest', (_req, _rep, done) =>
      RequestContext.create(orm.em, done),
    )
    .addHook('onRequest', (_req, _res, done) => {
      ServerRequestContext.create(serverContext(), done);
    })
    .addHook('onClose', async () => await orm.close())
    .register(
      fp((f, _, done) => {
        f.decorateRequest('serverCtx', null);
        f.addHook('onRequest', (req, _res, done) => {
          req.serverCtx = ServerRequestContext.currentServerContext()!;
          req.entityManager =
            RequestContext.getEntityManager()! as EntityManager;
          done();
        });
        done();
      }),
    );

  app.addHook('onResponse', (req, rep, done) => {
    if (req['disableRequestLogging']) {
      return;
    }
    const length = rep.getHeader('content-length');
    const lengthStr = run(() => {
      if (isString(length) || isNumber(length)) {
        return ` (${length} bytes) `;
      } else if (isArray(length) && length.length > 0) {
        return ` (${length[0]} bytes) `;
      } else {
        return ' ';
      }
    });

    const roundedTime = round(rep.elapsedTime, 4);

    logger.http(
      `${req.method} ${req.url} ${rep.statusCode} -${lengthStr}${roundedTime}ms`,
      {
        req: {
          method: req.method,
          url: req.url,
          status: rep.statusCode,
          elapsedTime: roundedTime,
        },
      },
    );
    done();
  });

  ctx.eventService.setup(app);

  // API Routers
  await app
    .register((f, _, done) => {
      f.addHook('onRoute', (route) => {
        if (!route.config) {
          route.config = {};
        }
        route.config.swaggerTransform = ({ schema, url }) => {
          const transformedSchema: FastifySchema = isUndefined(schema)
            ? {}
            : { ...schema };
          transformedSchema.hide = true;
          return { schema: transformedSchema, url };
        };
      });

      f.register(fpStatic, {
        root: path.join(serverOptions().databaseDirectory, 'images', 'uploads'),
        prefix: '/images/uploads',
      })
        .register(fpStatic, {
          root: path.join(currentDirectory, 'resources', 'images'),
          prefix: '/images',
          decorateReply: false,
        })
        .get('/favicon.svg', async (_, res) => {
          return res.sendFile(
            'favicon.svg',
            path.join(currentDirectory, 'resources', 'images'),
          );
        })
        .get('/favicon.ico', async (_, res) => {
          return res.sendFile(
            'favicon.ico',
            path.join(currentDirectory, 'resources', 'images'),
          );
        });
      done();
    })

    .register(async (f) => {
      await f.register(fpStatic, {
        root: path.join(opts.databaseDirectory, 'cache', 'images'),
        decorateReply: false,
        serve: false, // Use the interceptor
      });
      // f.addHook('onRequest', async (req, res) => ctx.cacheImageService.routerInterceptor(req, res));
      f.get<{ Params: { hash: string } }>(
        '/cache/images/:hash',
        {
          // Workaround for https://github.com/fastify/fastify/issues/4859
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onRequest: (req, res) => {
            return ctx.cacheImageService.routerInterceptor(req, res);
          },
        },
        async (req, res) => {
          return res.sendFile(req.params.hash);
        },
      );

      f.delete('/api/cache/images', async (req, res) => {
        try {
          await req.serverCtx.cacheImageService.clearCache();
          return res.status(200).send({ msg: 'Cache Image are Cleared' });
        } catch (error) {
          logger.error('Error deleting cached images', error);
          return res.status(500).send('error');
        }
      });
    })
    .register(async (f) => {
      f.addHook('onError', (req, _, error, done) => {
        logger.error(error, req.routeOptions.config.url);
        done();
      });
      await f
        .get('/', async (_, res) => res.redirect(302, '/web'))
        .register(plexServersRouter)
        .register(ffmpegSettingsRouter)
        .register(plexSettingsRouter)
        .register(xmlTvSettingsRouter)
        .register(hdhrSettingsRouter)
        .register(guideRouter)
        .register(apiRouter, { prefix: '/api' });
    })
    .register(videoRouter)
    .register(hlsApi)
    .register(ctx.hdhrService.createRouter())
    // Serve the webapp
    .register(
      async (f) => {
        // For assets that exist...
        await f.register(fpStatic, {
          root: path.join(currentDirectory, 'web'),
        });
        f.addHook('onRequest', (req, _, done) => {
          req.disableRequestLogging = true;
          done();
        });
        // Make it work with just '/web' and not '/web/;
        f.get('/', async (_, res) => {
          return res.sendFile('index.html', path.join(currentDirectory, 'web'));
        });
        // client side routing 'hack'. This makes navigating to other client-side
        // routes work as expected.
        f.setNotFoundHandler(async (_, res) => {
          return res.sendFile('index.html', path.join(currentDirectory, 'web'));
        });
      },
      { prefix: '/web' },
    );

  await updateXMLPromise;

  const host = process.env['TUNARR_BIND_ADDR'] ?? 'localhost';

  const url = await app
    .addHook('onClose', async () => {
      const ctx = serverContext();
      const t = new Date().getTime();
      ctx.eventService.push({
        type: 'lifecycle',
        message: `Initiated Server Shutdown`,
        detail: {
          time: t,
        },
        level: 'warning',
      });

      logger.info('Received exit signal, attempting graceful shutdown');

      try {
        logger.info('Waiting for pending jobs to complete');
        await schedule.gracefulShutdown();
      } catch (e) {
        logger.error('Scheduled job graceful shutdown failed.', e);
      }
    })
    .listen({
      host,
      port: opts.port,
    });

  logger.info(`HTTP server running on port: http://${host}:${opts.port}`);
  const hdhrSettings = ctx.settings.hdhrSettings();
  if (hdhrSettings.autoDiscoveryEnabled) {
    await ctx.hdhrService.ssdp.start();
  }

  ctx.eventService.push({
    type: 'lifecycle',
    message: `Server Started`,
    detail: {
      time: new Date().getTime(),
    },
    level: 'success',
  });

  return { app, url };
}
