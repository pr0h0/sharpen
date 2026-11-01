// All courses, in the order they appear on the home screen.
import type { Course } from '../types';
import { bayes } from './bayes';
import { biases } from './biases';
import { decisions } from './decisions';
import { logic } from './logic';
import { probability } from './probability';
import { strategy } from './strategy';

export const COURSES: Course[] = [probability, bayes, logic, decisions, biases, strategy];
