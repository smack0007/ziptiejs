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

interface BindContext {
    parent?: BindContext;

    view: HTMLElement;

    model: any;

    bindings: BindingsMap;

    getRoot(): BindContext;

    updateView(): void;
}

const ZipTie = (function(){
    // Internal API
    
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

    const _bind = function(view: HTMLElement, model: any, parent?: any): void {
        let context = (view as any)["z-context"] as BindContext;

        if (context === undefined) {
            context = {
                parent,
                view,
                model,
                bindings: {},
                getRoot: function() {  
                    let root = this;

                    while (root.parent !== undefined) {
                        root = root.parent;
                    }

                    return root;
                },
                updateView: function() {
                    for (const key of Object.keys(this.bindings)) {
                        switch (this.bindings[key].type) {
                            case BindingType.value:
                                _updateValueBinding(
                                    this.view,
                                    this.model,
                                    key,
                                    this.bindings[key]
                                );
                                break;

                            case BindingType.list:
                                _updateListBinding(
                                    this.view as HTMLTemplateElement,
                                    this.model,
                                    key,
                                    this.bindings[key] as ListBinding
                                );
                                break;
                        }
                    }

                    for (const child of this.view.children) {
                        _bind(child as HTMLElement, model, this);
                    }
                }
            } as BindContext;

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

            (view as any)["z-context"] = context;
        }

        context.updateView();
    };

    const _updateListBinding = function(view: HTMLTemplateElement, model: any, key: string, binding: ListBinding): void {
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
            model = { ...model, [binding.listVariable]: value };
            _bind(listItem, model, view.parentElement);
        }
    };

    const _updateValueBinding = function(view: any, model: any, key: string, binding: Binding): void {
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