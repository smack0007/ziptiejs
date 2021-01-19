"use strict";
const ZipTie = (function () {
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
    const _createBindingTreeNode = function (parent, updateView) {
        const node = {
            parent,
            children: [],
            updateView,
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
        let context = view["z-context"];
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
                    child.updateView();
                }
            });
            view["z-context"] = context;
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
                        context.getRoot().updateView();
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
        context.updateView();
    };
    const _bindText = function (view, model, parent) {
        let text = "";
        if (view.textContent) {
            text = view.textContent.trim();
        }
        if (!text.startsWith("{{") || !text.endsWith("}}")) {
            return;
        }
        let context = view["z-context"];
        if (context === undefined) {
            const key = text.substring("{{".length, text.length - "}}".length).trim();
            context = _createBindingTreeNode(parent, function () {
                view.textContent = model[key];
            });
        }
        context.updateView();
    };
    const _updateListBinding = function (context, view, model, key, binding) {
        if (view.parentElement === null) {
            return;
        }
        for (const listItem of binding.listItems) {
            listItem.remove();
        }
        binding.listItems = [];
        for (const value of model[binding.source]) {
            view.parentElement.appendChild(view.content.cloneNode(true));
            const listItem = view.parentElement.lastElementChild;
            binding.listItems.push(listItem);
            const listItemModel = Object.assign(Object.assign({}, model), { [binding.listVariable]: value });
            _bind(listItem, listItemModel, context);
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
        }
    };
})();
//# sourceMappingURL=ziptie.js.map