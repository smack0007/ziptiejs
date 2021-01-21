"use strict";
const ZipTie = (function () {
    const BINDING_TREE_NODE_PROPERTY = "z-bind";
    const OPEN_PLACEHOLDER = "{";
    const CLOSE_PLACEHOLDER = "}";
    let BindingType;
    (function (BindingType) {
        BindingType[BindingType["value"] = 0] = "value";
        BindingType[BindingType["list"] = 1] = "list";
    })(BindingType || (BindingType = {}));
    const _attributeNameMap = (function () {
        const typesToScan = [
            EventTarget.prototype,
            Node.prototype,
            Element.prototype,
            HTMLElement.prototype
        ];
        const map = {};
        for (const type of typesToScan) {
            for (const key of Object.keys(type)) {
                map[key.toLowerCase()] = key;
            }
        }
        return map;
    })();
    const _createBindingTreeNode = function (parent, update) {
        const node = {
            parent,
            children: [],
            update,
            getRoot: function () {
                let root = this;
                while (root.parent !== undefined) {
                    root = root.parent;
                }
                return root;
            }
        };
        if (parent !== undefined) {
            parent.children.push(node);
        }
        return node;
    };
    const _bind = function (view, model, parent) {
        let context = view[BINDING_TREE_NODE_PROPERTY];
        if (context === undefined) {
            const bindings = {};
            context = _createBindingTreeNode(parent, function () {
                for (const key of Object.keys(bindings)) {
                    switch (bindings[key].type) {
                        case BindingType.value:
                            _updateValueBinding(context, view, model, key, bindings[key]);
                            break;
                        case BindingType.list:
                            _updateListBinding(context, view, model, key, bindings[key]);
                            break;
                    }
                }
                for (const child of context.children) {
                    child.update();
                }
            });
            view[BINDING_TREE_NODE_PROPERTY] = context;
            for (let i = 0; i < view.attributes.length; i++) {
                const attribute = view.attributes[i];
                if (attribute.name.startsWith(":")) {
                    bindings[_attributeNameMap[attribute.name.substring(1)]] = {
                        type: BindingType.value,
                        source: attribute.value
                    };
                }
                if (attribute.name.startsWith("%")) {
                    bindings[_attributeNameMap[attribute.name.substring(1)]] = {
                        type: BindingType.list,
                        source: attribute.value,
                        listVariable: attribute.name.substring(1),
                        listItems: [],
                    };
                }
                if (attribute.name.startsWith("@")) {
                    const eventName = "on" + attribute.name.substring(1);
                    const eventHandler = function (...args) {
                        model[attribute.value](...args);
                        context.getRoot().update();
                    };
                    view[_attributeNameMap[eventName]] = eventHandler;
                }
            }
            for (let i = 0; i < view.childNodes.length; i++) {
                const childNode = view.childNodes[i];
                if (childNode.nodeType === Node.ELEMENT_NODE) {
                    _bind(childNode, model, context);
                }
                else if (childNode.nodeType === Node.TEXT_NODE) {
                    _bindText(childNode, model, context);
                }
            }
        }
        context.update();
    };
    const _bindText = function (view, model, parent) {
        let text = "";
        if (view.textContent) {
            text = view.textContent;
        }
        const parseResults = ZipTie.parseTextBinding(text);
        if (parseResults.length <= 1) {
            return;
        }
        let context = view[BINDING_TREE_NODE_PROPERTY];
        if (context === undefined) {
            context = _createBindingTreeNode(parent, function () {
                let newText = parseResults[0];
                for (let i = 1; i < parseResults.length; i++) {
                    newText = newText.replace(`{{${i}}}`, model[parseResults[i]]);
                }
                view.textContent = newText;
            });
        }
        context.update();
    };
    const _updateListBinding = function (bindingTreeNode, view, model, key, binding) {
        if (view.parentElement === null) {
            return;
        }
        for (const listItem of binding.listItems) {
            listItem.remove();
            const childBindingTreeNode = listItem[BINDING_TREE_NODE_PROPERTY];
            const childIndex = bindingTreeNode.children.indexOf(childBindingTreeNode);
            if (childIndex !== -1) {
                bindingTreeNode.children.splice(childIndex, 1);
            }
        }
        binding.listItems = [];
        for (const value of model[binding.source]) {
            view.parentElement.appendChild(view.content.cloneNode(true));
            const listItem = view.parentElement.lastElementChild;
            binding.listItems.push(listItem);
            const listItemModel = Object.assign(Object.assign({}, model), { [binding.listVariable]: value });
            _bind(listItem, listItemModel, bindingTreeNode);
        }
    };
    const _updateValueBinding = function (context, view, model, key, binding) {
        view[key] = model[binding.source];
    };
    return {
        bind: function (view, model, parent) {
            if (typeof view === "string") {
                const selector = view;
                view = document.querySelector(view);
                if (view === null) {
                    throw new Error(`Failed to fetch a DOM element with the selector "${selector}".`);
                }
            }
            _bind(view, model);
        },
        parseTextBinding: function (input) {
            const results = [""];
            let startPlaceholder = -1;
            let placeholderName = "";
            for (let i = 0; i < input.length; i++) {
                if (startPlaceholder === -1) {
                    if (input[i] === OPEN_PLACEHOLDER && i + 1 < input.length && input[i + 1] === OPEN_PLACEHOLDER) {
                        startPlaceholder = i + 2;
                        i++;
                    }
                    else {
                        results[0] += input[i];
                    }
                }
                else {
                    if (input[i] === CLOSE_PLACEHOLDER && i + 1 < input.length && input[i + 1] === CLOSE_PLACEHOLDER) {
                        results[0] += OPEN_PLACEHOLDER + OPEN_PLACEHOLDER + results.length + CLOSE_PLACEHOLDER + CLOSE_PLACEHOLDER;
                        results.push(placeholderName.trim());
                        startPlaceholder = -1;
                        placeholderName = "";
                        i++;
                    }
                    else {
                        placeholderName += input[i];
                    }
                }
            }
            return results;
        }
    };
})();
//# sourceMappingURL=ziptie.js.map