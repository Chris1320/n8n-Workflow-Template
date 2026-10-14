/**
 * Type definitions for n8n JavaScript Code node execution environment.
 * These globals are provided at runtime by n8n.
 */

// Import luxon DateTime type if available, otherwise define minimal interface
declare namespace n8n {
  interface DateTimeStatic {
    now(): any;
    fromISO(iso: string): any;
    fromMillis(ms: number): any;
    fromJSDate(date: Date): any;
    [key: string]: any;
  }

  interface InputItem {
    json: Record<string, any>;
    binary?: Record<string, any>;
    pairedItem?: { item: number } | number;
    [key: string]: any;
  }

  interface InputNode {
    /** Returns all input items from the specified input or first input by default */
    all(inputIndex?: number): InputItem[];
    /** Returns the first input item from the specified input */
    first(inputIndex?: number): InputItem;
    /** Returns the item matching the current execution context index */
    item: InputItem;
    /** Contextual execution params */
    context?: Record<string, any>;
    params?: Record<string, any>;
  }
}

declare const $input: n8n.InputNode;
declare const $json: Record<string, any>;
declare const $node: Record<string, any>;
declare const $prevNode: Record<string, any>;
declare const $workflow: {
  id: string;
  name: string;
  active: boolean;
};
declare const $execution: {
  id: string;
  mode: string;
  customData: Record<string, any>;
};
declare const DateTime: n8n.DateTimeStatic;
