import {
	getTSNodeRange,
	isGlobalDeclarationOfName,
	typescriptLanguage,
} from "@flint.fyi/typescript-language";
import ts from "typescript";

import { ruleCreator } from "./ruleCreator.ts";
import { isBuiltinSymbolLike } from "./utils/isBuiltinSymbolLike.ts";

const legacyStaticProperties = new Set([
	"$1",
	"$2",
	"$3",
	"$4",
	"$5",
	"$6",
	"$7",
	"$8",
	"$9",
	"$&",
	"$'",
	"$+",
	"$_",
	"$`",
	"input",
	"lastMatch",
	"lastParen",
	"leftContext",
	"rightContext",
]);

const legacyPrototypeMethods = new Set(["compile"]);

export default ruleCreator.createRule(typescriptLanguage, {
	about: {
		description:
			"Reports usage of legacy RegExp static properties and prototype methods.",
		id: "regexLegacyFeatures",
		presets: ["untyped"],
	},
	messages: {
		forbiddenPrototypeMethod: {
			primary: "The 'RegExp.prototype.{{ name }}' method is deprecated.",
			secondary: [
				"This method is a legacy feature and should not be used in modern code.",
				"It exists only for backwards compatibility with older scripts.",
			],
			suggestions: [
				"Create a new RegExp instance instead of recompiling an existing one.",
			],
		},
		forbiddenStaticProperty: {
			primary: "The 'RegExp.{{ name }}' static property is deprecated.",
			secondary: [
				"This property is a legacy feature and should not be used in modern code.",
				"It exists only for backwards compatibility with older scripts.",
			],
			suggestions: [
				"Capture the needed values from the match result instead of using global properties.",
			],
		},
	},
	setup(context) {
		return {
			visitors: {
				ElementAccessExpression: (node, { sourceFile, typeChecker }) => {
					if (
						!ts.isIdentifier(node.expression) ||
						node.expression.text !== "RegExp" ||
						!ts.isStringLiteral(node.argumentExpression)
					) {
						return;
					}

					// TODO: Use a util like getStaticValue
					// https://github.com/flint-fyi/flint/issues/1298
					const propertyName = node.argumentExpression.text;

					if (
						!legacyStaticProperties.has(propertyName) ||
						!isGlobalDeclarationOfName(node.expression, "RegExp", typeChecker)
					) {
						return;
					}

					context.report({
						data: { name: propertyName },
						message: "forbiddenStaticProperty",
						range: getTSNodeRange(node, sourceFile),
					});
				},
				PropertyAccessExpression: (
					node,
					{ program, sourceFile, typeChecker },
				) => {
					if (ts.isPrivateIdentifier(node.name)) {
						return;
					}

					// TODO: Use a util like getStaticValue
					// https://github.com/flint-fyi/flint/issues/1298
					const propertyName = node.name.text;

					if (ts.isIdentifier(node.expression)) {
						if (node.expression.text === "RegExp") {
							if (
								legacyStaticProperties.has(propertyName) &&
								isGlobalDeclarationOfName(
									node.expression,
									"RegExp",
									typeChecker,
								)
							) {
								context.report({
									data: { name: propertyName },
									message: "forbiddenStaticProperty",
									range: getTSNodeRange(node, sourceFile),
								});
							}
							return;
						}
					}

					if (!legacyPrototypeMethods.has(propertyName)) {
						return;
					}

					const objectType = typeChecker.getTypeAtLocation(node.expression);
					if (!isBuiltinSymbolLike(program, objectType, "RegExp")) {
						return;
					}

					context.report({
						data: { name: propertyName },
						message: "forbiddenPrototypeMethod",
						range: getTSNodeRange(node, sourceFile),
					});
				},
			},
		};
	},
});
