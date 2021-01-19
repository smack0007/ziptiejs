"use strict";
var BindingType;
(function (BindingType) {
    BindingType[BindingType["value"] = 0] = "value";
    BindingType[BindingType["list"] = 1] = "list";
})(BindingType || (BindingType = {}));
const ZipTie = (function () {
    // Internal API
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
    const _bind = function (view, model, parent) {
        let context = view["z-context"];
        if (context === undefined) {
            context = {
                parent,
                view,
                model,
                bindings: {},
                getRoot: function () {
                    let root = this;
                    while (root.parent !== undefined) {
                        root = root.parent;
                    }
                    return root;
                },
                updateView: function () {
                    for (const key of Object.keys(this.bindings)) {
                        switch (this.bindings[key].type) {
                            case BindingType.value:
                                _updateValueBinding(this.view, this.model, key, this.bindings[key]);
                                break;
                            case BindingType.list:
                                _updateListBinding(this.view, this.model, key, this.bindings[key]);
                                break;
                        }
                    }
                    for (const child of this.view.children) {
                        _bind(child, model, this);
                    }
                }
            };
            for (let i = 0; i < view.attributes.length; i++) {
                const attribute = view.attributes[i];
                if (attribute.name.startsWith(":")) {
                    context.bindings[_attributeNameMap[attribute.name.substring(1)]] = {
                        type: BindingType.value,
                        source: attribute.value
                    };
                }
                if (attribute.name.startsWith("%")) {
                    context.bindings[_attributeNameMap[attribute.name.substring(1)]] = {
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
            view["z-context"] = context;
        }
        context.updateView();
    };
    const _updateListBinding = function (view, model, key, binding) {
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
            model = Object.assign(Object.assign({}, model), { [binding.listVariable]: value });
            _bind(listItem, model, view.parentElement);
        }
    };
    const _updateValueBinding = function (view, model, key, binding) {
        view[key] = model[binding.source];
    };
    // Public API
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