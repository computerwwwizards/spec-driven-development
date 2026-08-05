# Feature: Extract bindings from a Minimal Specification

Minimal specification only contains the `Feature Title`, a `Scenarios Section` , whose start by default is marked by a `h2` level heading with the exact word "Scenarios" (camel case insensitive), this section MUST contain one or more `Scenario`, whose start MUST BE marked as a `h3` level heading inside the `Scenarios Section`. Each `Scenario` MUST contain at least one `Step`, each `Step` MUST be an unordered list item starting with a character `*` or `-`. The current markdown file is an actual `Minimal Specification` 

## Scenarios

### Matching this Scenario and extracting the values from its Steps

A `Step` can have some values, that MUST BE between `"` to be recognized as such,  that can be extracted in the execution binding. 

* Given that the contents of the current file are extracted in a string that is saved in the memory of the execution of the test.
* The current `Scenario` is registered by its `h3` title "Matching this Scenario and extracting the values from its Steps"
* The current `Step` is registered as "The current `Step` is registered as {currentStepInfo} asserting that `currentStepInfo` is the same as the `Step` match text " asserting that `currentStepInfo` is the same as the `Step` match text.



## Ambiguity

We have to decide yet if we are going to support an API that register the steps like a merging object, like this:

```typescript
Scenario("I am a scenario", ()=>{
  return {
    "Step 1": ()=>{}
  }
})
```

## Premortem

### Race conditions

The possibility to change in mid execution the configuration of an `Specification` object could lead to race conditions due to the need to run the Scenarios when possible either on parallel or concurrent.

The Interface of the registering steps is becoming cumbersome

