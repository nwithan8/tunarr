import { z } from 'zod';
import { RouterPluginAsyncCallback } from '../../types/serverType.js';
import { FillerListSchema } from '@tunarr/types/schemas';
import { isNil, map } from 'lodash-es';
import { CreateFillerListRequestSchema } from '@tunarr/types/api';

// eslint-disable-next-line @typescript-eslint/require-await
export const customShowsApiV2: RouterPluginAsyncCallback = async (fastify) => {
  fastify.get(
    '/filler-lists',
    {
      schema: {
        response: {
          200: z.array(FillerListSchema),
        },
      },
    },
    async (req, res) => {
      const fillers = await req.serverCtx.fillerDB.getAllFillers();

      return res.send(
        map(fillers, (f) => ({
          id: f.uuid,
          name: f.name,
          contentCount: f.content.length,
        })),
      );
    },
  );

  fastify.get(
    '/filler-lists/:id',
    {
      schema: {
        params: z.object({ id: z.string() }),
        response: {
          200: FillerListSchema,
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const filler = await req.serverCtx.fillerDB.getFiller(req.params.id);
      if (isNil(filler)) {
        return res.status(404).send();
      }

      return res.send({
        id: filler.uuid,
        name: filler.name,
        contentCount: filler.content.length,
      });
    },
  );

  fastify.post(
    '/filler-lists',
    {
      schema: {
        body: CreateFillerListRequestSchema,
        response: {
          201: z.object({ id: z.string() }),
        },
      },
    },
    async (_, res) => {
      return res.status(201).send({ id: 'TODO' });
    },
  );
};
