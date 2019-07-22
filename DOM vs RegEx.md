# DOM vs RegEx

Using innerHTML on a document node can be a cause for rejection as it will cause the document to be re-parsed, which is inefficient and has critical drawbacks, including invalidating any JavaScript reference to replaced DOM nodes, clearing any JavaScript properties and event listeners on replaced DOM nodes, and re-executing any script tags in the changed markup, and causing said scripts to fail.

## RegEX Method
1. Get the DOM
1. Convert the DOM to TEXT with innerHTML
1. Run Regular Expression to change the text
1. Convert back the TEXT into DOM
1. Inject the DOM back into the document

## DOM Method
1. Get the DOM
1. Change attributes (finished)
