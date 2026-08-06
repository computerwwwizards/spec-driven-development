export interface Store {
  data: Map<string, unknown>;
  register: (key: string, value: unknown) => void;
  get: <T>(key: string) => T;
}

export interface StepContext {
  store: Store;
  currentStep: { label: string; };
}

export type StepVariables = Record<string, string>;

export type StepHandler = (variables: StepVariables, ctx: StepContext) => void | Promise<void>;

export type StepRegistrationFn = (pattern: string, handler: StepHandler) => Promise<void> | void;

export type ScenarioBuilderCallback = (Step: StepRegistrationFn) => Promise<void> | void;

export interface FeatureConfig {
  rawMarkdown: string;
  omitNonRegisteredSteps?: boolean;
}

export interface Scenario {
  readonly id: string;
  readonly title: string;
  readonly tags: string[];
  readonly store: Store;
  configure: (configModifier: Partial<FeatureConfig> | ((prev: FeatureConfig) => FeatureConfig)) => Scenario;
  Step: StepRegistrationFn;
  run: () => Promise<void>;
}

export interface ScenarioConfig {
  match: string;
  id?: string;
}

export interface ScenarioRegistration {
  (pattern: string, stepBuilder?: ScenarioBuilderCallback): Scenario;
  (config: ScenarioConfig, stepBuilder?: ScenarioBuilderCallback): Scenario;
}

export interface FeatureInstance {
  scenarios: Map<string, Scenario>;
  Scenario: ScenarioRegistration;
}


function stripBackticks(str: string): string {
  return str.replace(/`/g, '');
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function parseMarkdown(markdown: string) {
  const lines = markdown.split('\n');
  let inScenarios = false;
  let scenariosContent = '';
  for (const line of lines) {
    if (line.match(/^##\s+Scenarios/i)) {
      inScenarios = true;
      continue;
    }
    if (inScenarios && line.match(/^##\s+/)) {
      break;
    }
    if (inScenarios) {
      scenariosContent += line + '\n';
    }
  }

  const scenarios: { title: string, steps: string[] }[] = [];
  let currentScenario: { title: string, steps: string[] } | null = null;

  const scLines = scenariosContent.split('\n');
  for (const scLine of scLines) {
    const titleMatch = scLine.match(/^###\s+(.*)/);
    if (titleMatch) {
      currentScenario = { title: titleMatch[1].trim(), steps: [] };
      scenarios.push(currentScenario);
    } else if (currentScenario) {
      const stepMatch = scLine.match(/^[*-]\s+(.+)/);
      if (stepMatch) {
        currentScenario.steps.push(stepMatch[1].trim());
      }
    }
  }

  return scenarios;
}

class StoreImpl implements Store {
  data = new Map<string, unknown>();

  register = (key: string, value: unknown) => {
    this.data.set(key, value);
  };

  get = <T>(key: string): T => {
    return this.data.get(key) as T;
  };
}

class ScenarioImpl implements Scenario {
  private _id: string;
  readonly title: string;
  readonly tags: string[] = [];
  readonly store: Store;
  readonly parsedSteps: string[];
  readonly steps = new Map<string, StepHandler>();
  private readonly initialFeatureConfig: FeatureConfig;
  private configOverrides: (Partial<FeatureConfig> | ((prev: FeatureConfig) => FeatureConfig))[] = [];

  constructor(id: string, title: string, parsedSteps: string[], featureConfig: FeatureConfig) {
    this._id = id;
    this.title = title;
    this.parsedSteps = parsedSteps;
    this.initialFeatureConfig = featureConfig;
    this.store = new StoreImpl();
  }

  get id(): string {
    return this._id;
  }

  set id(newId: string) {
    this._id = newId;
  }

  configure = (configModifier: Partial<FeatureConfig> | ((prev: FeatureConfig) => FeatureConfig)): Scenario => {
    this.configOverrides.push(configModifier);
    return this;
  };

  Step = (pattern: string, handler: StepHandler): void | Promise<void> => {
    this.steps.set(pattern, handler);
  };

  run = async (): Promise<void> => {
    let currentConfig = { ...this.initialFeatureConfig };
    for (const override of this.configOverrides) {
      if (typeof override === 'function') {
        currentConfig = override(currentConfig);
      } else {
        currentConfig = { ...currentConfig, ...override };
      }
    }

    for (const stepLabel of this.parsedSteps) {
      let stepMatched = false;
      let matchedHandler: StepHandler | null = null;
      let extractedVariables: StepVariables = {};

      const cleanStepLabel = stripBackticks(stepLabel);

      for (const [pattern, handler] of this.steps.entries()) {
        const cleanPattern = stripBackticks(pattern);

        // Handle optional trailing punctuation in both pattern and label
        const trailingPunctuationRegex = /[.,;:]$/;
        let normalizedPattern = cleanPattern;
        if (trailingPunctuationRegex.test(normalizedPattern)) {
          normalizedPattern = normalizedPattern.replace(trailingPunctuationRegex, '');
        }

        let normalizedStepLabel = cleanStepLabel;
        if (trailingPunctuationRegex.test(normalizedStepLabel)) {
          normalizedStepLabel = normalizedStepLabel.replace(trailingPunctuationRegex, '');
        }

        // Escape regex special chars
        let regexStr = normalizedPattern.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

        // Extract variable names from pattern
        const varNames: string[] = [];
        regexStr = regexStr.replace(/\\{([a-zA-Z0-9_]+)\\}/g, (match, varName) => {
          varNames.push(varName);
          return '"?(.*?)"?';
        });

        const regex = new RegExp(`^${regexStr}$`, 'i');
        const stepMatch = normalizedStepLabel.match(regex);

        if (stepMatch) {
          stepMatched = true;
          matchedHandler = handler;

          for (let i = 0; i < varNames.length; i++) {
            extractedVariables[varNames[i]] = stepMatch[i + 1];
          }
          break;
        }
      }

      if (!stepMatched) {
        if (!currentConfig.omitNonRegisteredSteps) {
          throw new Error(`Step not registered: ${stepLabel}`);
        }
      } else if (matchedHandler) {
        const ctx: StepContext = {
          store: this.store,
          currentStep: { label: stepLabel }
        };
        await matchedHandler(extractedVariables, ctx);
      }
    }
  };
}

export default function createFeature(
  config: FeatureConfig | string,
  builderCallback?: (Scenario: ScenarioRegistration) => Promise<void> | void
): FeatureInstance {
  const featureConfig: FeatureConfig = typeof config === 'string' ? { rawMarkdown: config } : config;
  const rawMarkdown = featureConfig.rawMarkdown;
  const parsedScenarios = parseMarkdown(rawMarkdown);

  const executableScenarios = new Map<string, ScenarioImpl>();

  // Initialize from parsed scenarios first
  for (const parsedScenario of parsedScenarios) {
    const scenarioId = slugify(parsedScenario.title);
    const title = stripBackticks(parsedScenario.title);
    const scenario = new ScenarioImpl(
      scenarioId,
      title,
      parsedScenario.steps,
      featureConfig
    );
    executableScenarios.set(scenarioId, scenario);
  }

  const Scenario: ScenarioRegistration = (
    configOrPattern: string | ScenarioConfig,
    stepBuilder?: ScenarioBuilderCallback
  ): Scenario => {
    const scenarioConfig: ScenarioConfig = typeof configOrPattern === 'string'
      ? { match: configOrPattern }
      : configOrPattern;

    const explicitId = scenarioConfig.id;

    // Try to find a matching scenario in currently initialized executableScenarios
    let matchedScenario: ScenarioImpl | undefined;

    for (const scenario of executableScenarios.values()) {
      const parsedTitleClean = stripBackticks(scenario.title).toLowerCase();
      const regMatchClean = stripBackticks(scenarioConfig.match).toLowerCase();

      if (parsedTitleClean === regMatchClean) {
        matchedScenario = scenario;
        break;
      }
    }

    if (!matchedScenario) {
      // If none matches, create a new one
      const scenarioId = explicitId || slugify(scenarioConfig.match);
      matchedScenario = new ScenarioImpl(
        scenarioId,
        stripBackticks(scenarioConfig.match),
        [],
        featureConfig
      );
      executableScenarios.set(scenarioId, matchedScenario);
    } else if (explicitId && matchedScenario.id !== explicitId) {
      // If it matched but we have an explicit ID and it differs from the current one,
      // update the ID and re-index in executableScenarios Map
      executableScenarios.delete(matchedScenario.id);
      matchedScenario.id = explicitId;
      executableScenarios.set(explicitId, matchedScenario);
    }

    if (stepBuilder) {
      const res = stepBuilder(matchedScenario.Step);
      if (res instanceof Promise) {
        // synchronous handling of stepBuilder call
      }
    }

    return matchedScenario;
  };

  // Map initially registered scenarios via callback if provided
  if (builderCallback) {
    builderCallback(Scenario);
  }

  return {
    scenarios: executableScenarios as Map<string, Scenario>,
    Scenario
  };
}
