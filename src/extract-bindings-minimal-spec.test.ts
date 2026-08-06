import { describe, it, expect } from 'vitest'
import createFeature, { StepVariables, StepContext } from './create-feature';
import markdown from './extract-bindings-minimal-spec.spec.md?raw'

describe("Feature: Extract bindings from minimal spec", () => {
  
  const feature = createFeature({
    rawMarkdown: markdown,
    omitNonRegisteredSteps: false
  }, (Scenario) => {
    Scenario(
      "Matching this Scenario and extracting the values from its Steps",
      (Step) => {
        
        Step(
          "Given that the contents of the current file are extracted in a string that is saved in the memory of the execution of the test",
          (_variables: StepVariables, ctx: StepContext) => {
            const { store } = ctx;
            store.register("markdownContent", markdown);
          }
        );
        
        Step(
          "The current Scenario is registered by its h3 title {scenarioTitle}",
          async (variables: StepVariables, ctx: StepContext) => {
            const { store } = ctx;
            const scenarioTitle = variables.scenarioTitle;
            
            console.log(`[Test] Setting up internal feature for title: ${scenarioTitle}`);
            
            const markdownContent = store.get<string>("markdownContent");
            const internalFeature = createFeature(markdownContent);

            const firstScenario = internalFeature.Scenario({ 
              id: "firstScenario", 
              match: scenarioTitle 
            });

            store.register("firstScenario", firstScenario);
            store.register("specification", internalFeature);
          }
        );

        Step(
          "The current Step is registered as {currentStepInfo} asserting that currentStepInfo is the same as the Step match text.",
          async (variables: StepVariables, ctx: StepContext) => {
            const { store } = ctx;
            const currentStepInfo = variables.currentStepInfo;
            
            console.log(`[Test] Overwriting logic for step: ${currentStepInfo}`);
            
            const internalFeature = store.get<ReturnType<typeof createFeature>>("specification"); 
            const firstScenario = store.get<any>("firstScenario");

            const configuredScenario = firstScenario
              .configure({ omitNonRegisteredSteps: true })
              .configure((prev: any) => ({ ...prev }));

            expect(configuredScenario).toBe(firstScenario);

            firstScenario.Step(currentStepInfo, (innerVars: StepVariables, innerCtx: StepContext) => {
              console.log(`[Test Assertion] Variables matched inside inner execution!`);
              expect(innerVars.currentStepInfo).toBe(innerCtx.currentStep.label);
            });

            const targetScenario = internalFeature.scenarios.get("firstScenario");
            
            if (!targetScenario) {
              console.error("[Test Error] Target scenario not found! Check scenarioTitle matching.");
              return;
            }
            
            console.log(`[Test] Programmatically executing targeted internal scenario...`);
            await targetScenario.run();
          }
        );
      }
    );
  });

  for (const scenario of feature.scenarios.values()) {
    it(`Scenario: ${scenario.title}`, async () => {
      await scenario.run();
    });
  }

});