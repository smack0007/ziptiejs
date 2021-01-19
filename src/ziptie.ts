const ZipTie = (function(){
    //
    // Constants
    //

    const BINDING_TREE_NODE_PROPERTY = "z-bind";
    const OPEN_PLACEHOLDER = "{{";
    const CLOSE_PLACEHOLDER = "}}";

    //
    // Internal API
    //

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

        children: BindingTreeNode[];

        getRoot(): BindingTreeNode;

        update(): void;
    }

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

    const _createBindingTreeNode = function(parent: BindingTreeNode | undefined, update: () => void): BindingTreeNode {
        const node = {
            parent,
            children: [],
            update,
            getRoot: function() {  
                let root = this;

                while (root.parent !== undefined) {
                    root = root.parent;
                }

                return root;
            }
        } as BindingTreeNode;

        if (parent !== undefined) {
            parent.children.push(node);
        }

        return node;
    };

    const _bind = function(view: HTMLElement, model: any, parent?: BindingTreeNode): void {
        let context = (view as any)[BINDING_TREE_NODE_PROPERTY] as BindingTreeNode;

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

                for (const child of context.children) {
                    child.update();
                }

                if (context.parent === undefined) {
                    console.debug(context);
                }
            });

            (view as any)[BINDING_TREE_NODE_PROPERTY] = context;

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
                        context.getRoot().update();
                    };
                    
                    (view as any)[_attributeNameMap[eventName]] = eventHandler;
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
        }

        context.update();
    };

    const _bindText = function(view: Text, model: any, parent: BindingTreeNode): void {
        let text = "";
        
        if (view.textContent) {
            text = view.textContent.trim();
        }

        // TODO: Add support for multiple placeholders
        if (!text.startsWith(OPEN_PLACEHOLDER) || !text.endsWith(CLOSE_PLACEHOLDER)) {
            return;
        }
        
        let context = (view as any)[BINDING_TREE_NODE_PROPERTY] as BindingTreeNode;

        if (context === undefined) {
            const key = text.substring(OPEN_PLACEHOLDER.length, text.length - CLOSE_PLACEHOLDER.length).trim();
            context = _createBindingTreeNode(parent, function() {
                view.textContent = model[key];
            });
        }

        context.update();
    };

    const _updateListBinding = function(bindingTreeNode: BindingTreeNode, view: HTMLTemplateElement, model: any, key: string, binding: ListBinding): void {
        if (view.parentElement === null) {
            return;
        }
        
        for (const listItem of binding.listItems) {
            listItem.remove();
            const childBindingTreeNode = (listItem as any)[BINDING_TREE_NODE_PROPERTY];
            const childIndex = bindingTreeNode.children.indexOf(childBindingTreeNode);
            if (childIndex !== -1) {
                bindingTreeNode.children.splice(childIndex, 1);
            }
        }
        
        binding.listItems = [];

        for (const value of model[binding.source]) {
            view.parentElement.appendChild(view.content.cloneNode(true)) as HTMLElement;
            const listItem = view.parentElement.lastElementChild as HTMLElement;
            binding.listItems.push(listItem);
            const listItemModel = { ...model, [binding.listVariable]: value };
            _bind(listItem, listItemModel, bindingTreeNode);
        }
    };

    const _updateValueBinding = function(context: BindingTreeNode, view: any, model: any, key: string, binding: Binding): void {
        view[key] = model[binding.source];
    };

    //
    // Public API
    //

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