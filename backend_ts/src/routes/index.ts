import { Router } from 'express';
import { Game } from '../game';
import z from 'zod';

export const router = Router();

router.get('/world', (req, res) => {
  const items = Game.instances.map((el) => ({
    id: el.id,
    name: el.name,
    x: el.x,
    y: el.y,
    epoch: el.epoch.toString(),
    isRunning: el.isRunning,
  }));

  res.json({
    ok: true,
    items,
  });
});

const newWorldModel = z.object({
  name: z.string().min(1),
  x: z.number().positive().int().max(0xffffffff),
  y: z.number().positive().int().max(0xffffffff),
  start: z.boolean().optional().default(false),
});

router.post('/world', (req, res) => {
  const body = newWorldModel.parse(req.body);
  const game = Game.fromObject({
    name: body.name,
    x: body.x,
    y: body.y,
    isRunning: body.start,
  });
  res.json({
    ok: true,
    id: game.id,
  });
});

export default router;