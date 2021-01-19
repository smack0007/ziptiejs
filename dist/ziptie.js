"use strict";
const ZipTie = (function () {
    const attributeNameMap = (function () {
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
    return {
        bind: function (view, model, parent) {
            if (typeof view === "string") {
                const selector = view;
                view = document.querySelector(view);
                if (view === null) {
                    throw new Error(`Failed to fetch a DOM element with the selector "${selector}".`);
                }
            }
            console.info("bind", view);
            let context = view["z-context"];
            if (context === undefined) {
                console.info("context not found...");
                const viewBindings = {};
                context = {
                    parent,
                    view,
                    viewBindings,
                    model,
                    getRoot: function () {
                        let root = this;
                        while (root.parent !== undefined) {
                            root = root.parent;
                        }
                        return root;
                    },
                    updateView: function () {
                        console.info('updateView', this);
                        for (const viewKey of Object.keys(this.viewBindings)) {
                            this.view[viewKey] = this.model[this.viewBindings[viewKey]];
                        }
                        for (const child of this.view.children) {
                            ZipTie.bind(child, model, this);
                        }
                    }
                };
                for (let i = 0; i < view.attributes.length; i++) {
                    const attribute = view.attributes[i];
                    if (attribute.name.startsWith(":")) {
                        viewBindings[attributeNameMap[attribute.name.substring(1)]] = attribute.value;
                    }
                    if (attribute.name.startsWith("@")) {
                        const eventName = "on" + attribute.name.substring(1);
                        const eventHandler = function (...args) {
                            model[attribute.value](...args);
                            context.getRoot().updateView();
                        };
                        view[attributeNameMap[eventName]] = eventHandler;
                    }
                }
                view["z-context"] = context;
            }
            context.updateView();
        }
    };
})();
