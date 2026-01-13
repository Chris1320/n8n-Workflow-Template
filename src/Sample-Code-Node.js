/**
 * Print a message with a name and age.
 * @param {string} name A name.
 * @param {number} age An age.
 * @returns {string} A message containing the name and age.
 */
function main(name, age) {
    const /** @type {import("./types/SampleCodeTypes").Person} */ person = { name: name, age: age };
    const /** @type {string} */ result = `${person.name} is ${person.age} years old.`;
    return result;
}

// @ts-ignore this comes from a previous n8n node.
const username = $input.first().json.Name;
// @ts-ignore this comes from a previous n8n node.
const userage = $input.first().json.Age;

// @ts-ignore n8n requires a return value.
return { result: main(username, userage) };
