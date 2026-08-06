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

export interface ExecutableScenario {
  id: string;
  title: string;
  tags: string[];
  run: () => Promise<void>;
}

export interface ScenarioConfig {
  match: string;
  id?: string;
}

export interface ScenarioInstance {
  explicitId?: string;
  configure: (configModifier: (prev: FeatureConfig) => FeatureConfig) => void;
  Step: StepRegistrationFn;
  run(): Promise<void>;
}

export interface ScenarioRegistration {
  (pattern: string, stepBuilder?: ScenarioBuilderCallback): ScenarioInstance;
  (config: ScenarioConfig, stepBuilder?: ScenarioBuilderCallback): ScenarioInstance;
}

export interface FeatureInstance {
  scenarios: Map<string, ExecutableScenario>;
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

class StoreImpl {
  data = new Map<string, unknown>();

  register = (key: string, value: unknown) => {
    this.data.set(key, value);
  };

  get = <T>(key: string): T => {
    return this.data.get(key) as T;
  };
}

export default function createFeature(
  config: FeatureConfig | string,
  builderCallback?: (Scenario: ScenarioRegistration) => Promise<void> | void
): FeatureInstance {
  const featureConfig: FeatureConfig = typeof config === 'string' ? { rawMarkdown: config } : config;
  const rawMarkdown = featureConfig.rawMarkdown;
  const parsedScenarios = parseMarkdown(rawMarkdown);

  const registeredScenarios = new Map<string, {
    config: ScenarioConfig;
    steps: Map<string, StepHandler>;
    featureConfigOverrides: ((prev: FeatureConfig) => FeatureConfig)[];
  }>();

  const Scenario: ScenarioRegistration = (
    configOrPattern: string | ScenarioConfig,
    stepBuilder?: ScenarioBuilderCallback
  ): ScenarioInstance => {
    const scenarioConfig: ScenarioConfig = typeof configOrPattern === 'string'
      ? { match: configOrPattern }
      : configOrPattern;

    const scenarioId = scenarioConfig.id || slugify(scenarioConfig.match);

    const steps = new Map<string, StepHandler>();
    const featureConfigOverrides: ((prev: FeatureConfig) => FeatureConfig)[] = [];

    registeredScenarios.set(scenarioId, {
      config: scenarioConfig,
      steps,
      featureConfigOverrides
    });

    const Step: StepRegistrationFn = (pattern, handler) => {
      steps.set(pattern, handler);
    };

    if (stepBuilder) {
      const res = stepBuilder(Step);
      if (res instanceof Promise) {
        // synchronous handling for now based on types
      }
    }

    // Try to map to a parsed scenario
    let matchedParsedScenario = null;
    for (const parsedScenario of parsedScenarios) {
      const parsedTitleClean = stripBackticks(parsedScenario.title).toLowerCase();
      const regMatchClean = stripBackticks(scenarioConfig.match).toLowerCase();

      if (parsedTitleClean === regMatchClean) {
        matchedParsedScenario = parsedScenario;
        break;
      }
    }

    if (matchedParsedScenario) {
      executableScenarios.set(scenarioId, createExecutableScenario(scenarioId, matchedParsedScenario, {
        config: scenarioConfig,
        steps,
        featureConfigOverrides
      }));
    }
    // TODO: actually we dont need a scenario liek this, more liek a escutable complete scenario and teh scenario sextuable also has the same thigns as this scenario at teh same time, liek a merge progapate for all the code
    return {
      explicitId: scenarioConfig.id,
      configure: (modifier) => {
        featureConfigOverrides.push(modifier);
      },
      Step,
    };
  };

  const executableScenarios = new Map<string, ExecutableScenario>();

  function createExecutableScenario(id: string, parsedScenario: {title: string, steps: string[]}, regScen: any): ExecutableScenario {
    return {
      id: id,
      title: stripBackticks(parsedScenario.title),
      tags: [], // Tags extraction not in requirements but could be added
      run: async () => {
        const store = new StoreImpl();

        let currentConfig = { ...featureConfig };
        for (const override of regScen.featureConfigOverrides) {
          currentConfig = override(currentConfig);
        }

        for (const stepLabel of parsedScenario.steps) {
          let stepMatched = false;
          let matchedHandler: StepHandler | null = null;
          let extractedVariables: StepVariables = {};

          const cleanStepLabel = stripBackticks(stepLabel);

          for (const [pattern, handler] of regScen.steps.entries()) {
            const cleanPattern = stripBackticks(pattern);

            // Build regex from pattern
            // Pattern might look like: The current Step is registered as {currentStepInfo} ...
            // We want to match anything for {currentStepInfo}, potentially with or without double quotes

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
              store,
              currentStep: { label: stepLabel }
            };
            await matchedHandler(extractedVariables, ctx);
          }
        }
      }
    };
  }

  // Map initially registered scenarios
  if (builderCallback) {
    builderCallback(Scenario);
  }

  // Always include parsed scenarios even if not registered explicitly so they can fail on steps
  for (const parsedScenario of parsedScenarios) {
    let isMapped = false;
    for (const [id, regScen] of registeredScenarios.entries()) {
      const parsedTitleClean = stripBackticks(parsedScenario.title).toLowerCase();
      const regMatchClean = stripBackticks(regScen.config.match).toLowerCase();

      if (parsedTitleClean === regMatchClean) {
        isMapped = true;
        break;
      }
    }

    if (!isMapped) {
      const scenarioId = slugify(parsedScenario.title);
      executableScenarios.set(scenarioId, createExecutableScenario(scenarioId, parsedScenario, {
        config: { match: parsedScenario.title },
        steps: new Map(),
        featureConfigOverrides: []
      }));
    }
  }

  return {
    scenarios: executableScenarios,
    Scenario
  };
}
