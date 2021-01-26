const BINDING_TREE_NODE_PROPERTY = "z-bind";
const OPEN_PLACEHOLDER = "{";
const CLOSE_PLACEHOLDER = "}";

class ZipTie {
    private static readonly _attributeNameMap = (function(): { [key: string]: string } {        
        const typesToScan = [
            EventTarget.prototype,
            Node.prototype,
            Element.prototype,
            HTMLElement.prototype
        ];
        
        const map: { [key: string]: string } = {};
    
        for (const type of typesToScan) {
            for (const key of Object.keys(type)) {
                map[key.toLowerCase()] = key;
            }
        }
    
        return map;
    })();

    public static bind(view: HTMLElement | string, model: any, parent?: any): void {
        if (typeof view === "string") {
            const selector = view as string;
            view = document.querySelector(view) as HTMLElement;

            if (view === null) {
                throw new Error(`Failed to fetch a DOM element with the selector "${selector}".`);
            }
        }

        ZipTie._bind(view, model);
    }

    private static _parseTextBinding(input: string): string[] {
        const results = [ "" ];

        let startPlaceholder = -1;
        let placeholderName = "";
        for (let i = 0; i < input.length; i++) {
            if (startPlaceholder === -1) {
                if (input[i] === OPEN_PLACEHOLDER && i + 1 < input.length && input[i + 1] === OPEN_PLACEHOLDER) {
                    startPlaceholder = i + 2;
                    i++;
                } else {
                    results[0] += input[i];
                }
            } else {
                if (input[i] === CLOSE_PLACEHOLDER && i + 1 < input.length && input[i + 1] === CLOSE_PLACEHOLDER) {
                    results[0] += OPEN_PLACEHOLDER + OPEN_PLACEHOLDER + results.length + CLOSE_PLACEHOLDER + CLOSE_PLACEHOLDER;
                    results.push(placeholderName.trim());
                    startPlaceholder = -1;
                    placeholderName = "";
                    i++;
                } else {
                    placeholderName += input[i];
                }
            }
        }
        
        return results;
    }

    public static _bind(view: HTMLElement, model: any, parent?: ZipTieBindingTreeNode): void {
        let bindingTreeNode = (view as any)[BINDING_TREE_NODE_PROPERTY] as ZipTieBindingTreeNode;

        if (bindingTreeNode === undefined) {
            const bindings: { [key: string]: ZipTieBinding } = {};

            bindingTreeNode = new ZipTieBindingTreeNode(parent, bindings, function() {
                for (const key of Object.keys(bindings)) {
                    bindings[key].update(view, model);
                }

                for (const child of bindingTreeNode.children) {
                    child.update();
                }

                // Use this sometimes to see how the binding tree updates
                // if (bindingTreeNode.parent === undefined) {
                //     console.debug(bindingTreeNode);
                // }
            });

            (view as any)[BINDING_TREE_NODE_PROPERTY] = bindingTreeNode;

            for (let i = 0; i < view.attributes.length; i++) {
                const attribute = view.attributes[i];

                if (attribute.name.startsWith(":")) {
                    bindings[ZipTie._attributeNameMap[attribute.name.substring(1)]] =
                        new ZipTieValueBinding(
                            ZipTie._attributeNameMap[attribute.name.substring(1)],
                            attribute.value);
                }

                if (attribute.name.startsWith("%")) {
                    bindings[ZipTie._attributeNameMap[attribute.name.substring(1)]] =
                        new ZipTieListBinding(
                            bindingTreeNode,
                            attribute.name.substring(1),
                            attribute.value);
                }

                if (attribute.name.startsWith("@")) {
                    const eventName = "on" + attribute.name.substring(1);
                    
                    const eventHandler = function(...args: any[]) {
                        model[attribute.value](...args);
                        bindingTreeNode.getRoot().update();
                    };
                    
                    (view as any)[ZipTie._attributeNameMap[eventName]] = eventHandler;
                }
            }

            for (let i = 0; i < view.childNodes.length; i++) {
                const childNode = view.childNodes[i];

                if (childNode.nodeType === Node.ELEMENT_NODE) {
                    ZipTie._bind(childNode as HTMLElement, model, bindingTreeNode);
                } else if (childNode.nodeType === Node.TEXT_NODE) {
                    ZipTie._bindText(childNode as Text, model, bindingTreeNode);
                }
            }
        }

        bindingTreeNode.update();
    }

    private static _bindText(view: Text, model: any, parent: ZipTieBindingTreeNode): void {
        let text = "";
        
        if (view.textContent) {
            text = view.textContent;
        }

        const textBinding = ZipTie._parseTextBinding(text);
        if (textBinding.length <= 1) {
            return;
        }
        
        let context = (view as any)[BINDING_TREE_NODE_PROPERTY] as ZipTieBindingTreeNode;

        if (context === undefined) {
            context = new ZipTieBindingTreeNode(parent, textBinding, function() {
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

class ZipTieBindingTreeNode {
    public children: ZipTieBindingTreeNode[] = [];
    
    constructor(
        public parent: ZipTieBindingTreeNode | undefined,
        public bindings: any,
        public update: () => void,
    ) {
        if (parent !== undefined) {
            parent.children.push(this);
        }
    }

    public getRoot(): ZipTieBindingTreeNode {  
        let root: ZipTieBindingTreeNode = this;

        while (root.parent !== undefined) {
            root = root.parent;
        }

        return root;
    };
}

interface ZipTieBinding {
    update(view: HTMLElement, model: any): void;
}

class ZipTieValueBinding implements ZipTieBinding {
    constructor(
        public readonly viewKey: string,
        public readonly modelKey: string,
    ) {
    }
    
    public update(view: HTMLElement, model: any): void {
        (view as any)[this.viewKey] = model[this.modelKey];
    }
}

class ZipTieListBinding extends ZipTieValueBinding {
    public listItems: HTMLElement[] = [];
    
    constructor(
        public readonly bindingTreeNode: ZipTieBindingTreeNode,
        public readonly listVariable: string,
        modelKey: string
    ) {
        super("", modelKey);
    }

    public update(view: HTMLTemplateElement, model: any): void {        
        if (view.parentElement === null) {
            return;
        }
        
        for (const listItem of this.listItems) {
            listItem.remove();
            const childBindingTreeNode = (listItem as any)[BINDING_TREE_NODE_PROPERTY];
            const childIndex = this.bindingTreeNode.children.indexOf(childBindingTreeNode);
            if (childIndex !== -1) {
                this.bindingTreeNode.children.splice(childIndex, 1);
            }
        }
        
        this.listItems = [];

        for (const value of model[this.modelKey]) {
            view.parentElement.appendChild(view.content.cloneNode(true)) as HTMLElement;
            const listItem = view.parentElement.lastElementChild as HTMLElement;
            this.listItems.push(listItem);
            const listItemModel = { ...model, [this.listVariable]: value };
            ZipTie._bind(listItem, listItemModel, this.bindingTreeNode);
        }
    }
}
