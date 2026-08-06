/**
 * Represents the shared memory state accessible during step execution.
 * Ensures data isolation across different scenarios and features.
 */
export interface Store {
  /**
   * The underlying Map storing the state.
   */
  data: Map<string, unknown>;
  /**
   * Registers a value into the store.
   * 
   * @example
   * store.register("markdownContent", "# Feature...");
   */
  register: (key: string, value: unknown) => void;
  /**
   * Retrieves a typed value from the store.
   * 
   * @example
   * const content = store.get<string>("markdownContent");
   */
  get: <T>(key: string) => T;
}

/**
 * The contextual environment provided to every step handler during execution.
 */
export interface StepContext {
  /** The isolated store for the current execution context. */
  store: Store;
  /** Metadata regarding the currently executing step. */
  currentStep: {
    /** The raw Markdown label of the step being executed. */
    label: string;
  };
}

/**
 * A dictionary of variables extracted from the Markdown string based on regex capture groups.
 */
export type StepVariables = Record<string, string>;

/**
 * The callback function executed when a step matches a registered pattern.
 * 
 * @example
 * (variables, ctx) => {
 *   expect(variables.userName).toBe("Admin");
 * }
 */
export type StepHandler = (variables: StepVariables, ctx: StepContext) => void | Promise<void>;

/**
 * Registers a specific pattern to a handler function.
 * 
 * **Tolerance Note:** The matching logic strips backticks (`) from both the 
 * registered pattern and the parsed Markdown before comparison, ensuring that 
 * inline code formatting does not cause brittle match failures.
 */
export type StepRegistrationFn = (pattern: string, handler: StepHandler) => Promise<void> | void;

/**
 * A callback function providing the Step registration tool.
 */
export type ScenarioBuilderCallback = (Step: StepRegistrationFn) => Promise<void> | void;

/**
 * Configuration options for initializing a Feature engine.
 */
export interface FeatureConfig {
  /** The raw Markdown specification string. */
  rawMarkdown: string;
  /** If true, the engine will not throw an error if a parsed step lacks a registered handler. */
  omitNonRegisteredSteps?: boolean;
}

/**
 * A merged representation of an isolated, executable unit representing a single Markdown Scenario.
 */
export interface Scenario {
  /** The deterministic slug or explicitly provided identifier. */
  readonly id: string;
  /** The cleaned title of the scenario, stripped of tags. */
  readonly title: string;
  /** Extracted metadata tags (e.g., ['smoke', 'e2e']). */
  readonly tags: string[];
  /** The isolated store initialized for the execution of this scenario. */
  readonly store: Store;
  /** Merges new configuration values into the current scenario scope. */
  configure: (configModifier: Partial<FeatureConfig> | ((prev: FeatureConfig) => FeatureConfig)) => Scenario;
  /** Registers a step specifically within the scope of this Scenario. */
  Step: StepRegistrationFn;
  /**
   * Triggers the evaluation of this specific scenario's steps.
   * 
   * **Execution Note:** Calling `.run()` isolates execution to this specific AST node.
   * This targeted dispatch prevents the infinite loops associated with self-referential
   * monolithic `execute()` loops in meta-testing.
   */
  run: () => Promise<void>;
}

/**
 * Configuration object for polymorphic Scenario registration.
 */
export interface ScenarioConfig {
  /** 
   * The pattern to match against the Markdown H3 heading. 
   * Tolerates and ignores backticks (`).
   */
  match: string;
  /** An explicit identifier to bypass automatic title slugification. */
  id?: string;
}

/**
 * Registers a Scenario within the Feature engine.
 * Supports polymorphic signatures (String Pattern vs Configuration Object).
 */
export interface ScenarioRegistration {
  /**
   * Registers a scenario using a simple string pattern.
   * 
   * @example
   * Scenario("User attempts to login", (Step) => { ... });
   */
  (pattern: string, stepBuilder?: ScenarioBuilderCallback): Scenario;
  /**
   * Registers a scenario using a configuration object to provide an explicit ID.
   * 
   * @example
   * Scenario({ match: "User attempts to login", id: "AUTH-01" }, (Step) => { ... });
   */
  (config: ScenarioConfig, stepBuilder?: ScenarioBuilderCallback): Scenario;
}

/**
 * The root instance returned by the Feature factory.
 * Exposes the iterable Map of compiled scenarios and the dynamic registration API.
 */
export interface FeatureInstance {
  /**
   * An iterable Hash Map of scenarios, indexed by their ID.
   * Enables O(1) lookups for targeted execution to avoid recursive loops.
   */
  scenarios: Map<string, Scenario>;
  /**
   * The dynamic registration API. Exposed to allow Just-In-Time (JIT) 
   * meta-testing and late-binding configurations.
   */
  Scenario: ScenarioRegistration;
}

/**
 * Parses a Minimal Specification Markdown string and returns a constrained 
 * execution engine.
 * 
 * @param config The raw markdown string or a configuration object.
 * @param builderCallback Optional callback to synchronously register Scenarios.
 * @returns A FeatureInstance containing the isolated, executable scenarios.
 */
export default function createFeature(
  config: FeatureConfig | string, 
  builderCallback?: (Scenario: ScenarioRegistration) => Promise<void> | void
): FeatureInstance;
