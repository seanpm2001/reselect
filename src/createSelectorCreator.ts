import { defaultMemoize } from './defaultMemoize'
import type {
  Combiner,
  CreateSelectorOptions,
  DropFirstParameter,
  ExtractMemoizerFields,
  GetParamsFromSelectors,
  GetStateFromSelectors,
  OutputSelector,
  Selector,
  SelectorArray,
  StabilityCheckFrequency,
  UnknownMemoizer
} from './types'
import {
  assertIsFunction,
  collectInputSelectorResults,
  ensureIsArray,
  getDependencies,
  runStabilityCheck
} from './utils'

/**
 * An instance of `createSelector`, customized with a given memoize implementation.
 *
 * @template MemoizeFunction - The type of the memoize function that is used to memoize the `resultFunc` inside `createSelector` (e.g., `defaultMemoize` or `weakMapMemoize`).
 * @template ArgsMemoizeFunction - The type of the optional memoize function that is used to memoize the arguments passed into the output selector generated by `createSelector` (e.g., `defaultMemoize` or `weakMapMemoize`). If none is explicitly provided, `defaultMemoize` will be used.
 */
export interface CreateSelectorFunction<
  MemoizeFunction extends UnknownMemoizer,
  ArgsMemoizeFunction extends UnknownMemoizer = typeof defaultMemoize
> {
  /** Input selectors as separate inline arguments */
  <InputSelectors extends SelectorArray, Result>(
    ...createSelectorArgs: [
      ...inputSelectors: InputSelectors,
      combiner: Combiner<InputSelectors, Result>
    ]
  ): OutputSelector<
    InputSelectors,
    Result,
    MemoizeFunction,
    ArgsMemoizeFunction
  >

  /** Input selectors as separate inline arguments with memoizeOptions passed */
  <
    InputSelectors extends SelectorArray,
    Result,
    OverrideMemoizeFunction extends UnknownMemoizer = MemoizeFunction,
    OverrideArgsMemoizeFunction extends UnknownMemoizer = ArgsMemoizeFunction
  >(
    ...createSelectorArgs: [
      ...inputSelectors: InputSelectors,
      combiner: Combiner<InputSelectors, Result>,
      createSelectorOptions: Partial<
        CreateSelectorOptions<
          MemoizeFunction,
          ArgsMemoizeFunction,
          OverrideMemoizeFunction,
          OverrideArgsMemoizeFunction
        >
      >
    ]
  ): OutputSelector<
    InputSelectors,
    Result,
    OverrideMemoizeFunction,
    OverrideArgsMemoizeFunction
  >

  /**
   * Creates a memoized selector function.
   *
   * @param inputSelectors - An array of input selectors.
   * @param combiner - A function that Combines the input selectors and returns an output selector. Otherwise known as the result function.
   * @param createSelectorOptions - An optional options object that allows for further customization per selector.
   * @returns An output selector.
   *
   * @template InputSelectors - The type of the input selectors array.
   * @template Result - The return type of the `combiner` as well as the output selector.
   * @template OverrideMemoizeFunction - The type of the optional `memoize` function that could be passed into the options object to override the original `memoize` function that was initially passed into `createSelectorCreator`.
   * @template OverrideArgsMemoizeFunction - The type of the optional `argsMemoize` function that could be passed into the options object to override the original `argsMemoize` function that was initially passed into `createSelectorCreator`.
   */
  <
    InputSelectors extends SelectorArray,
    Result,
    OverrideMemoizeFunction extends UnknownMemoizer = MemoizeFunction,
    OverrideArgsMemoizeFunction extends UnknownMemoizer = ArgsMemoizeFunction
  >(
    inputSelectors: [...InputSelectors],
    combiner: Combiner<InputSelectors, Result>,
    createSelectorOptions?: Partial<
      CreateSelectorOptions<
        MemoizeFunction,
        ArgsMemoizeFunction,
        OverrideMemoizeFunction,
        OverrideArgsMemoizeFunction
      >
    >
  ): OutputSelector<
    InputSelectors,
    Result,
    OverrideMemoizeFunction,
    OverrideArgsMemoizeFunction
  >
}

let globalStabilityCheck: StabilityCheckFrequency = 'once'

/**
 * In development mode, an extra check is conducted on your input selectors.
 * It runs your input selectors an extra time with the same arguments, and warns in the console if they return a different result _(based on your `memoize` method)_.
 *
 * This function allows you to override this setting for all of your selectors.
 *
 * **Note**: This setting can still be overridden per selector inside `createSelector`'s `options` object.
 *
 * _The input stability check does not run in production builds._
 *
 * @param inputStabilityCheckFrequency - How often the `inputStabilityCheck` should run for all selectors.
 */
export function setInputStabilityCheckEnabled(
  inputStabilityCheckFrequency: StabilityCheckFrequency
) {
  globalStabilityCheck = inputStabilityCheckFrequency
}

/**
 * Creates a selector creator function with the specified memoization function and options for customizing memoization behavior.
 *
 * @param options - An options object containing the `memoize` function responsible for memoizing the `resultFunc` inside `createSelector` (e.g., `defaultMemoize` or `weakMapMemoize`). It also provides additional options for customizing memoization. While the `memoize` property is mandatory, the rest are optional.
 * @returns A customized `createSelector` function.
 *
 * @example
 * ```ts
 * const customCreateSelector = createSelectorCreator({
 *   memoize: customMemoize, // Function to be used to memoize `resultFunc`
 *   memoizeOptions: [memoizeOption1, memoizeOption2], // Options passed to `customMemoize` as the second argument onwards
 *   argsMemoize: customArgsMemoize, // Function to be used to memoize the selector's arguments
 *   argsMemoizeOptions: [argsMemoizeOption1, argsMemoizeOption2] // Options passed to `customArgsMemoize` as the second argument onwards
 * })
 *
 * const customSelector = customCreateSelector(
 *   [inputSelector1, inputSelector2],
 *   resultFunc // `resultFunc` will be passed as the first argument to `customMemoize`
 * )
 *
 * customSelector(
 *   ...selectorArgs // Will be memoized by `customArgsMemoize`
 * )
 * ```
 *
 * @template MemoizeFunction - The type of the memoize function that is used to memoize the `resultFunc` inside `createSelector` (e.g., `defaultMemoize` or `weakMapMemoize`).
 * @template ArgsMemoizeFunction - The type of the optional memoize function that is used to memoize the arguments passed into the output selector generated by `createSelector` (e.g., `defaultMemoize` or `weakMapMemoize`). If none is explicitly provided, `defaultMemoize` will be used.
 */
export function createSelectorCreator<
  MemoizeFunction extends UnknownMemoizer,
  ArgsMemoizeFunction extends UnknownMemoizer = typeof defaultMemoize
>(
  options: CreateSelectorOptions<
    MemoizeFunction,
    typeof defaultMemoize,
    never,
    ArgsMemoizeFunction
  >
): CreateSelectorFunction<MemoizeFunction, ArgsMemoizeFunction>

/**
 * Creates a selector creator function with the specified memoization function and options for customizing memoization behavior.
 *
 * @param memoize - The `memoize` function responsible for memoizing the `resultFunc` inside `createSelector` (e.g., `defaultMemoize` or `weakMapMemoize`).
 * @param memoizeOptionsFromArgs - Optional configuration options for the memoization function. These options are then passed to the memoize function as the second argument onwards.
 * @returns A customized `createSelector` function.
 *
 * @example
 * ```ts
 * const customCreateSelector = createSelectorCreator(customMemoize, // Function to be used to memoize `resultFunc`
 *   option1, // Will be passed as second argument to `customMemoize`
 *   option2, // Will be passed as third argument to `customMemoize`
 *   option3 // Will be passed as fourth argument to `customMemoize`
 * )
 *
 * const customSelector = customCreateSelector(
 *   [inputSelector1, inputSelector2],
 *   resultFunc // `resultFunc` will be passed as the first argument to `customMemoize`
 * )
 * ```
 *
 * @template MemoizeFunction - The type of the memoize function that is used to memoize the `resultFunc` inside `createSelector` (e.g., `defaultMemoize` or `weakMapMemoize`).
 */
export function createSelectorCreator<MemoizeFunction extends UnknownMemoizer>(
  memoize: MemoizeFunction,
  ...memoizeOptionsFromArgs: DropFirstParameter<MemoizeFunction>
): CreateSelectorFunction<MemoizeFunction>

/**
 * Creates a selector creator function with the specified memoization function and options for customizing memoization behavior.
 *
 * @param memoizeOrOptions - Either A `memoize` function or an `options` object containing the `memoize` function.
 * @param memoizeOptionsFromArgs - Optional configuration options for the memoization function. These options are then passed to the memoize function as the second argument onwards.
 * @returns A customized `createSelector` function.
 *
 * @template MemoizeFunction - The type of the memoize function that is used to memoize the `resultFunc` inside `createSelector` (e.g., `defaultMemoize` or `weakMapMemoize`).
 * @template ArgsMemoizeFunction - The type of the optional memoize function that is used to memoize the arguments passed into the output selector generated by `createSelector` (e.g., `defaultMemoize` or `weakMapMemoize`). If none is explicitly provided, `defaultMemoize` will be used.
 * @template MemoizeOrOptions - The type of the first argument. It can either be a `memoize` function or an `options` object containing the `memoize` function.
 */
export function createSelectorCreator<
  MemoizeFunction extends UnknownMemoizer,
  ArgsMemoizeFunction extends UnknownMemoizer,
  MemoizeOrOptions extends
    | MemoizeFunction
    | CreateSelectorOptions<MemoizeFunction, ArgsMemoizeFunction>
>(
  memoizeOrOptions: MemoizeOrOptions,
  ...memoizeOptionsFromArgs: MemoizeOrOptions extends CreateSelectorOptions<
    MemoizeFunction,
    ArgsMemoizeFunction
  >
    ? never
    : DropFirstParameter<MemoizeFunction>
) {
  /** options initially passed into `createSelectorCreator`. */
  const createSelectorCreatorOptions: CreateSelectorOptions<
    MemoizeFunction,
    ArgsMemoizeFunction
  > =
    typeof memoizeOrOptions === 'function'
      ? {
          memoize: memoizeOrOptions as MemoizeFunction,
          memoizeOptions: memoizeOptionsFromArgs
        }
      : memoizeOrOptions

  const createSelector = <
    Selectors extends SelectorArray,
    Result,
    OverrideMemoizeFunction extends UnknownMemoizer = MemoizeFunction,
    OverrideArgsMemoizeFunction extends UnknownMemoizer = ArgsMemoizeFunction
  >(
    ...funcs: [
      ...inputSelectors: [...Selectors],
      combiner: Combiner<Selectors, Result>,
      createSelectorOptions?: Partial<
        CreateSelectorOptions<
          MemoizeFunction,
          ArgsMemoizeFunction,
          OverrideMemoizeFunction,
          OverrideArgsMemoizeFunction
        >
      >
    ]
  ) => {
    let recomputations = 0
    let lastResult: Result

    // Due to the intricacies of rest params, we can't do an optional arg after `...funcs`.
    // So, start by declaring the default value here.
    // (And yes, the words 'memoize' and 'options' appear too many times in this next sequence.)
    let directlyPassedOptions: Partial<
      CreateSelectorOptions<
        MemoizeFunction,
        ArgsMemoizeFunction,
        OverrideMemoizeFunction,
        OverrideArgsMemoizeFunction
      >
    > = {}

    // Normally, the result func or "combiner" is the last arg
    let resultFunc = funcs.pop() as
      | Combiner<Selectors, Result>
      | Partial<
          CreateSelectorOptions<
            MemoizeFunction,
            ArgsMemoizeFunction,
            OverrideMemoizeFunction,
            OverrideArgsMemoizeFunction
          >
        >

    // If the result func is actually an _object_, assume it's our options object
    if (typeof resultFunc === 'object') {
      directlyPassedOptions = resultFunc
      // and pop the real result func off
      resultFunc = funcs.pop() as Combiner<Selectors, Result>
    }

    assertIsFunction(
      resultFunc,
      `createSelector expects an output function after the inputs, but received: [${typeof resultFunc}]`
    )

    // Determine which set of options we're using. Prefer options passed directly,
    // but fall back to options given to createSelectorCreator.
    const combinedOptions = {
      ...createSelectorCreatorOptions,
      ...directlyPassedOptions
    }

    const {
      memoize,
      memoizeOptions = [],
      argsMemoize = defaultMemoize,
      argsMemoizeOptions = [],
      inputStabilityCheck = globalStabilityCheck
    } = combinedOptions

    // Simplifying assumption: it's unlikely that the first options arg of the provided memoizer
    // is an array. In most libs I've looked at, it's an equality function or options object.
    // Based on that, if `memoizeOptions` _is_ an array, we assume it's a full
    // user-provided array of options. Otherwise, it must be just the _first_ arg, and so
    // we wrap it in an array so we can apply it.
    const finalMemoizeOptions = ensureIsArray(memoizeOptions)
    const finalArgsMemoizeOptions = ensureIsArray(argsMemoizeOptions)
    const dependencies = getDependencies(funcs) as Selectors

    const memoizedResultFunc = memoize(function recomputationWrapper() {
      recomputations++
      // apply arguments instead of spreading for performance.
      // @ts-ignore
      return (resultFunc as Combiner<Selectors, Result>).apply(null, arguments)
    }, ...finalMemoizeOptions) as Combiner<Selectors, Result> &
      ExtractMemoizerFields<OverrideMemoizeFunction>

    let firstRun = true

    // If a selector is called with the exact same arguments we don't need to traverse our dependencies again.
    // TODO This was changed to `memoize` in 4.0.0 ( #297 ), but I changed it back.
    // The original intent was to allow customizing things like skortchmark's
    // selector debugging setup.
    // But, there's multiple issues:
    // - We don't pass in `memoizeOptions`
    // Arguments change all the time, but input values change less often.
    // Most of the time shallow equality _is_ what we really want here.
    // TODO Rethink this change, or find a way to expose more options?
    // @ts-ignore
    const selector = argsMemoize(function dependenciesChecker() {
      /** Return values of input selectors which the `resultFunc` takes as arguments. */
      const inputSelectorResults = collectInputSelectorResults(
        dependencies,
        arguments
      )

      const shouldRunInputStabilityCheck =
        process.env.NODE_ENV !== 'production' &&
        (inputStabilityCheck === 'always' ||
          (inputStabilityCheck === 'once' && firstRun))

      if (shouldRunInputStabilityCheck) {
        // make a second copy of the params, to check if we got the same results
        const inputSelectorResultsCopy = collectInputSelectorResults(
          dependencies,
          arguments
        )

        runStabilityCheck(
          { inputSelectorResults, inputSelectorResultsCopy },
          { memoize, memoizeOptions: finalMemoizeOptions },
          arguments
        )

        if (firstRun) firstRun = false
      }

      // apply arguments instead of spreading for performance.
      // @ts-ignore
      lastResult = memoizedResultFunc.apply(null, inputSelectorResults)

      return lastResult
    }, ...finalArgsMemoizeOptions) as Selector<
      GetStateFromSelectors<Selectors>,
      Result,
      GetParamsFromSelectors<Selectors>
    > &
      ExtractMemoizerFields<OverrideArgsMemoizeFunction>

    return Object.assign(selector, {
      resultFunc,
      memoizedResultFunc,
      dependencies,
      lastResult: () => lastResult,
      recomputations: () => recomputations,
      resetRecomputations: () => (recomputations = 0),
      memoize,
      argsMemoize
    }) as OutputSelector<
      Selectors,
      Result,
      OverrideMemoizeFunction,
      OverrideArgsMemoizeFunction
    >
  }
  return createSelector as CreateSelectorFunction<
    MemoizeFunction,
    ArgsMemoizeFunction
  >
}

export const createSelector =
  /* #__PURE__ */ createSelectorCreator(defaultMemoize)
