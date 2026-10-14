// @id: ae9ae0b3-e9a0-488a-8c2d-d8a39fd2e07d

/**
 * Print a message with a name and age.
 *
 * @param {string} name A name.
 * @param {number} age An age.
 * @returns {string} A message containing the name and age.
 */
function main(name, age) {
  // NOTE: We use JSDoc type annotations so that it will not throw an error in n8n,
  // which does not support TypeScript syntax without complex configuration.
  const /** @type {import("../types/SampleCodeTypes").Person} */ person = {
      name: name,
      age: age,
    };
  const /** @type {string} */ result = `${person.name} is ${person.age} years old.`;
  return result;
}

// Global $input is declared in src/types/n8n.d.ts (no @ts-ignore needed!)
const username = $input.first().json.Name;
const userage = $input.first().json.Age;

// @ts-ignore Top-level return in n8n execution scope
return { result: main(username, userage) };
