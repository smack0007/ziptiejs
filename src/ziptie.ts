type AttributeNameMap = { [key: string]: string };

enum BindingType {
    value,

    list
}

interface Binding {
    type: BindingType;

    source: string;
}

interface ListBinding extends Binding {
    listVariable: string;
    
    listItems: HTMLElement[];
}

type BindingsMap = { [key: string]: Binding };

interface BindingTreeNode {
    parent: BindingTreeNode | undefined;

    getRoot(): BindingTreeNode;

    updateView(): void;
}

const ZipTie = (function(){
    //
    // Internal API
    //

    const _attributeNameMap = (function(): AttributeNameMap {
        const typesToScan = [
            EventTarget.prototype,
            Node.prototype,
            Element.prototype,
            HTMLElement.prototype
        ];
        
        const map: AttributeNameMap = {};

        for (const type of typesToScan) {
            for (const key of Object.keys(type)) {
                map[key.toLowerCase()] = key;
            }
        }

        return map;
    })();

    const _createBindingTreeNode = function(parent: BindingTreeNode | undefined, updateView: () => void): BindingTreeNode {
        return {
            parent,
            updateView,
            getRoot: function() {  
                let root = this;

                while (root.parent !== undefined) {
                    root = root.parent;
                }

                return root;
            }
        } as BindingTreeNode;
    };

    const _bind = function(view: HTMLElement, model: any, parent?: BindingTreeNode): void {
        let context = (view as any)["z-context"] as BindingTreeNode;

        if (context === undefined) {
            const bindings: BindingsMap = {};

            context = _createBindingTreeNode(parent, function() {
                for (const key of Object.keys(bindings)) {
                    switch (bindings[key].type) {
                        case BindingType.value:
                            _updateValueBinding(
                                context,
                                view,
                                model,
                                key,
                                bindings[key]
                            );
                            break;

                        case BindingType.list:
                            _updateListBinding(
                                context,
                                view as HTMLTemplateElement,
                                model,
                                key,
                                bindings[key] as ListBinding
                            );
                            break;
                    }
                }

                for (let i = 0; i < view.childNodes.length; i++) {
                    const childNode = view.childNodes[i];

                    if (childNode.nodeType === Node.ELEMENT_NODE) {
                        _bind(childNode as HTMLElement, model, context);
                    } else if (childNode.nodeType === Node.TEXT_NODE) {
                        _bindText(childNode as Text, model, context);
                    }
                }
            });

            (view as any)["z-context"] = context;

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
                    } as ListBinding;
                }

                if (attribute.name.startsWith("@")) {
                    const eventName = "on" + attribute.name.substring(1);
                    
                    const eventHandler = function(...args: any[]) {
                        model[attribute.value](...args);
                        context.getRoot().updateView();
                    };
                    
                    (view as any)[_attributeNameMap[eventName]] = eventHandler;
                }
            }
        }

        context.updateView();
    };

    const _bindText = function(view: Text, model: any, parent: BindingTreeNode): void {
        let text = "";
        
        if (view.textContent) {
            text = view.textContent.trim();
        }

        if (!text.startsWith("{{") || !text.endsWith("}}")) {
            return;
        }
        
        let context = (view as any)["z-context"] as BindingTreeNode;

        if (context === undefined) {
            // TODO: The {{ }} will only be replaced one time. We need to remember this somehow.

            context = _createBindingTreeNode(parent, function() {
                const key = text.substring("{{".length, text.length - "}}".length).trim();
                view.textContent = model[key];
            });
        }

        context.updateView();
    };

    const _updateListBinding = function(context: BindingTreeNode, view: HTMLTemplateElement, model: any, key: string, binding: ListBinding): void {
        if (view.parentElement === null) {
            return;
        }
        
        for (const listItem of binding.listItems) {
            listItem.remove();
        }
        
        binding.listItems = [];

        for (const value of model[binding.source]) {
            view.parentElement.appendChild(view.content.cloneNode(true)) as HTMLElement;
            const listItem = view.parentElement.lastElementChild as HTMLElement;
            binding.listItems.push(listItem);
            const listItemModel = { ...model, [binding.listVariable]: value };
            _bind(listItem, listItemModel, context);
        }
    };

    const _updateValueBinding = function(context: BindingTreeNode, view: any, model: any, key: string, binding: Binding): void {
        view[key] = model[binding.source];
    };

    // Public API

    return {
        bind: function(view: HTMLElement | string, model: any, parent?: any): void {
            if (typeof view === "string") {
                const selector = view as string;
                view = document.querySelector(view) as HTMLElement;

                if (view === null) {
                    throw new Error(`Failed to fetch a DOM element with the selector "${selector}".`);
                }
            }

            _bind(view, model);
        }
    }
})();