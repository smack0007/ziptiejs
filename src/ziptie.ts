type AttributeNameMap = { [key: string]: string };

type ViewBindingsMap = { [key: string]: string };

interface BindContext {
    parent?: BindContext;

    view: HTMLElement;

    viewBindings: ViewBindingsMap;

    model: any;

    getRoot(): BindContext;

    updateView(): void;
}

const ZipTie = (function(){
    const attributeNameMap = (function(): AttributeNameMap {
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

    return {
        bind: function(view: HTMLElement | string, model: any, parent?: any): void {
            if (typeof view === "string") {
                const selector = view as string;
                view = document.querySelector(view) as HTMLElement;

                if (view === null) {
                    throw new Error(`Failed to fetch a DOM element with the selector "${selector}".`);
                }
            }

            console.info("bind", view);

            let context = (view as any)["z-context"] as BindContext;

            if (context === undefined) {
                console.info("context not found...");

                const viewBindings: ViewBindingsMap = {};

                context = {
                    parent,
                    view,
                    viewBindings,
                    model,
                    getRoot: function() {  
                        let root = this;

                        while (root.parent !== undefined) {
                            root = root.parent;
                        }

                        return root;
                    },
                    updateView: function() {
                        console.info('updateView', this);

                        for (const viewKey of Object.keys(this.viewBindings)) {
                            (this.view as any)[viewKey] = this.model[this.viewBindings[viewKey]];
                        }

                        for (const child of this.view.children) {
                            ZipTie.bind(child as HTMLElement, model, this);
                        }
                    }
                } as BindContext;

                for (let i = 0; i < view.attributes.length; i++) {
                    const attribute = view.attributes[i];

                    if (attribute.name.startsWith(":")) {
                        viewBindings[attributeNameMap[attribute.name.substring(1)]] = attribute.value;
                    }

                    if (attribute.name.startsWith("@")) {
                        const eventName = "on" + attribute.name.substring(1);
                        
                        const eventHandler = function(...args: any[]) {
                            model[attribute.value](...args);
                            context.getRoot().updateView();
                        };
                        
                        (view as any)[attributeNameMap[eventName]] = eventHandler;
                    }
                }

                (view as any)["z-context"] = context;
            }

            context.updateView();
        }
    }
})();