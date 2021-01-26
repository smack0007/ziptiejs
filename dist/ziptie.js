"use strict";
const BINDING_TREE_NODE_PROPERTY = "z-bind";
const OPEN_PLACEHOLDER = "{";
const CLOSE_PLACEHOLDER = "}";
class ZipTie {
    static bind(view, model, parent) {
        if (typeof view === "string") {
            const selector = view;
            view = document.querySelector(view);
            if (view === null) {
                throw new Error(`Failed to fetch a DOM element with the selector "${selector}".`);
            }
        }
        ZipTie._bind(view, model);
    }
    static _parseTextBinding(input) {
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
    static _bind(view, model, parent) {
        let bindingTreeNode = view[BINDING_TREE_NODE_PROPERTY];
        if (bindingTreeNode === undefined) {
            const bindings = {};
            bindingTreeNode = new ZipTieBindingTreeNode(parent, bindings, function () {
                for (const key of Object.keys(bindings)) {
                    bindings[key].update(view, model);
                }
                for (const child of bindingTreeNode.children) {
                    child.update();
                }
            });
            view[BINDING_TREE_NODE_PROPERTY] = bindingTreeNode;
            for (let i = 0; i < view.attributes.length; i++) {
                const attribute = view.attributes[i];
                if (attribute.name.startsWith(":")) {
                    bindings[ZipTie._attributeNameMap[attribute.name.substring(1)]] =
                        new ZipTieValueBinding(ZipTie._attributeNameMap[attribute.name.substring(1)], attribute.value);
                }
                if (attribute.name.startsWith("%")) {
                    bindings[ZipTie._attributeNameMap[attribute.name.substring(1)]] =
                        new ZipTieListBinding(bindingTreeNode, attribute.name.substring(1), attribute.value);
                }
                if (attribute.name.startsWith("@")) {
                    const eventName = "on" + attribute.name.substring(1);
                    const eventHandler = function (...args) {
                        model[attribute.value](...args);
                        bindingTreeNode.getRoot().update();
                    };
                    view[ZipTie._attributeNameMap[eventName]] = eventHandler;
                }
            }
            for (let i = 0; i < view.childNodes.length; i++) {
                const childNode = view.childNodes[i];
                if (childNode.nodeType === Node.ELEMENT_NODE) {
                    ZipTie._bind(childNode, model, bindingTreeNode);
                }
                else if (childNode.nodeType === Node.TEXT_NODE) {
                    ZipTie._bindText(childNode, model, bindingTreeNode);
                }
            }
        }
        bindingTreeNode.update();
    }
    static _bindText(view, model, parent) {
        let text = "";
        if (view.textContent) {
            text = view.textContent;
        }
        const textBinding = ZipTie._parseTextBinding(text);
        if (textBinding.length <= 1) {
            return;
        }
        let context = view[BINDING_TREE_NODE_PROPERTY];
        if (context === undefined) {
            context = new ZipTieBindingTreeNode(parent, textBinding, function () {
                let newText = textBinding[0];
                for (let i = 1; i < textBinding.length; i++) {
                    newText = newText.replace(`{{${i}}}`, model[textBinding[i]]);
                }
                view.textContent = newText;
            });
        }
        context.update();
    }
}
ZipTie._attributeNameMap = (function () {
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
class ZipTieBindingTreeNode {
    constructor(parent, bindings, update) {
        this.parent = parent;
        this.bindings = bindings;
        this.update = update;
        this.children = [];
        if (parent !== undefined) {
            parent.children.push(this);
        }
    }
    getRoot() {
        let root = this;
        while (root.parent !== undefined) {
            root = root.parent;
        }
        return root;
    }
    ;
}
class ZipTieValueBinding {
    constructor(viewKey, modelKey) {
        this.viewKey = viewKey;
        this.modelKey = modelKey;
    }
    update(view, model) {
        view[this.viewKey] = model[this.modelKey];
    }
}
class ZipTieListBinding extends ZipTieValueBinding {
    constructor(bindingTreeNode, listVariable, modelKey) {
        super("", modelKey);
        this.bindingTreeNode = bindingTreeNode;
        this.listVariable = listVariable;
        this.listItems = [];
    }
    update(view, model) {
        if (view.parentElement === null) {
            return;
        }
        for (const listItem of this.listItems) {
            listItem.remove();
            const childBindingTreeNode = listItem[BINDING_TREE_NODE_PROPERTY];
            const childIndex = this.bindingTreeNode.children.indexOf(childBindingTreeNode);
            if (childIndex !== -1) {
                this.bindingTreeNode.children.splice(childIndex, 1);
            }
        }
        this.listItems = [];
        for (const value of model[this.modelKey]) {
            view.parentElement.appendChild(view.content.cloneNode(true));
            const listItem = view.parentElement.lastElementChild;
            this.listItems.push(listItem);
            const listItemModel = Object.assign(Object.assign({}, model), { [this.listVariable]: value });
            ZipTie._bind(listItem, listItemModel, this.bindingTreeNode);
        }
    }
}
//# sourceMappingURL=ziptie.js.map