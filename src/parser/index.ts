import { readFileSync } from 'fs';
import yaml from 'js-yaml';
import type { ComplyConfig, PolicyConfig } from '../types/index.js';

const VALID_RISK_TIERS = ['prohibited', 'high', 'limited', 'minimal'] as const;

export function parseComplyConfig(filePath: string): ComplyConfig {
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(raw) as Record<string, unknown>;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('comply.yaml must be a YAML object');
  }

  const project = parsed['project'] as Record<string, unknown>;
  if (!project || !project['name'] || !project['version'] || !project['owner']) {
    throw new Error('project.name, project.version, project.owner are required');
  }

  const models = parsed['models'] as unknown[];
  if (!Array.isArray(models) || models.length === 0) {
    throw new Error('models[] is required and must have at least one entry');
  }

  for (const m of models) {
    const model = m as Record<string, unknown>;
    if (!model['id']) throw new Error(`model missing required field: id`);
    if (!model['provider']) throw new Error(`model ${model['id']}: missing provider`);
    if (!model['use_case']) throw new Error(`model ${model['id']}: missing use_case`);
    if (!VALID_RISK_TIERS.includes(model['risk_tier'] as typeof VALID_RISK_TIERS[number])) {
      throw new Error(`model ${model['id']}: risk_tier must be one of ${VALID_RISK_TIERS.join(', ')}`);
    }
    if (typeof model['human_oversight'] !== 'boolean') {
      throw new Error(`model ${model['id']}: human_oversight must be a boolean`);
    }
    if (!Array.isArray(model['data_categories'])) {
      throw new Error(`model ${model['id']}: data_categories must be an array`);
    }
  }

  const agents = Array.isArray(parsed['agents']) ? parsed['agents'] : [];
  for (const a of agents) {
    const agent = a as Record<string, unknown>;
    if (!agent['id']) throw new Error(`agent missing required field: id`);
    if (!agent['model']) throw new Error(`agent ${agent['id']}: missing model ref`);
    if (!Array.isArray(agent['tools'])) throw new Error(`agent ${agent['id']}: tools must be an array`);
    if (typeof agent['outputs_affect_humans'] !== 'boolean') {
      throw new Error(`agent ${agent['id']}: outputs_affect_humans must be a boolean`);
    }
  }

  return parsed as unknown as ComplyConfig;
}

export function parsePolicyConfig(filePath: string): PolicyConfig {
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(raw) as Record<string, unknown>;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('policy.yaml must be a YAML object');
  }

  if (!parsed['name']) throw new Error('policy.name is required');
  if (!Array.isArray(parsed['rules'])) throw new Error('policy.rules[] is required');

  return parsed as unknown as PolicyConfig;
}
