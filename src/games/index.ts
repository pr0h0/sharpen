import type { Game } from './game';
import { estimate } from './estimate';
import { fermi } from './fermi';
import { target } from './target';
import { sprint } from './sprint';
import { rules } from './rules';
import { grid } from './grid';
import { odds } from './odds';
import { fallacy } from './fallacy';

export const GAMES: Game[] = [estimate, target, odds, rules, fermi, grid, fallacy, sprint];
