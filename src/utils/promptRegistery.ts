import path from 'path';
import * as vscode from 'vscode';

interface RegisteredPrompt extends vscode.QuickPickItem {
    tag: string;
    ref: string; // Either a local path or a git ref: `<provider>:<owner>/<repo>?path=<path>`
    mcp: boolean;
}

export const showRegistryInput = async (context: vscode.ExtensionContext) => {
    let registry = context.globalState.get('registry') as { [key: string]: RegisteredPrompt } || {};
    if (Object.keys(registry).length === 0) {
        registry = {
            'placeholder': {
                label: 'Placeholder',
                ref: 'github:docker/labs-ai-tools-for-devs?path=prompts/npm-project.md',
                mcp: false,
                tag: 'placeholder'
            },
            'placeholder2': {
                label: 'Placeholder2',
                ref: 'github:docker/labs-ai-tools-for-devs?path=prompts/examples/explain_dockerfile.md',
                mcp: true,
                tag: 'placeholder2'
            },
            'placeholder3': {
                label: 'Placeholder3',
                ref: 'github:docker/labs-ai-tools-for-devs?path=prompts/examples/curl.md',
                mcp: false,
                tag: 'placeholder3'
            }
            ,
            'placeholder4': {
                label: 'Placeholder4',
                ref: '~/Dev/labs-ai-tools-for-devs/prompts/examples/curl.md',
                mcp: false,
                tag: 'placeholder4'
            }
        };
        await context.globalState.update('registry', registry);
    }
    const refreshItems = async () => {
        input.items = Object.values(await context.globalState.get('registry') as { [key: string]: RegisteredPrompt }).map(registeredPrompt => ({
            ...registeredPrompt, buttons:
                [
                    {
                        tooltip: 'Run',
                        iconPath: new vscode.ThemeIcon('run')
                    },
                    {
                        tooltip: 'Open',
                        text: 'Open',
                        iconPath: new vscode.ThemeIcon('open-preview')
                    }
                ],
            detail: registeredPrompt.mcp ? 'MCP' : 'Not MCP'
        }));
    }
    const input = vscode.window.createQuickPick<RegisteredPrompt>();
    input.canSelectMany = true;
    input.matchOnDescription = true;
    input.matchOnDetail = true;
    input.placeholder = 'Start typing to search or paste a prompt reference to register';
    refreshItems();
    input.onDidChangeSelection((selection) => {
        if (selection.length > 0 && input.buttons.find(button => button.tooltip === 'Delete all') === undefined) {
            input.buttons = [
                {
                    tooltip: 'Delete all',
                    iconPath: new vscode.ThemeIcon('trash')
                },
                {
                    tooltip: 'Register selection as MCP servers',
                    iconPath: new vscode.ThemeIcon('eye')
                },
                {
                    tooltip: 'Unregister selection as MCP servers',
                    iconPath: new vscode.ThemeIcon('eye-closed')
                }
            ];
        }
        if (selection.length === 0 && !input.buttons.find(button => button.tooltip === 'Delete all')) {
            input.buttons = [];
        }
    });
    input.onDidChangeValue((value) => {
        try {
            const uri = convertRefInputToURI(value);
            input.items = [...input.items, { label: `Register ${uri.path}`, ref: uri.toString(), mcp: false, tag: uri.path, detail: uri.toString() }];
        } catch (e) {
            // Input is not a valid reference
        }
    });
    input.onDidAccept(() => {
        input.hide();
        if (input.selectedItems.length === 0) {

        }

    });
    input.onDidTriggerButton(async (button) => {
        if (button.tooltip === 'Delete all') {
            const reg = context.globalState.get('registry') as { [key: string]: RegisteredPrompt };
            let deleted = 0;
            for (const item of input.selectedItems) {
                delete reg[item.tag];
                deleted++;
            }
            vscode.window.showInformationMessage(`Deleted ${deleted} prompts`);
            await context.globalState.update('registry', reg);
            await refreshItems();
        }
        if (button.tooltip === 'Register selection as MCP servers') {
            const reg = context.globalState.get('registry') as { [key: string]: RegisteredPrompt };
            let registered = 0;
            for (const item of input.selectedItems) {
                reg[item.tag].mcp = true;
                registered++;
            }
            vscode.window.showInformationMessage(`Registered ${registered} prompts as MCP servers`);
            await context.globalState.update('registry', reg);
            await refreshItems();
        }
        if (button.tooltip === 'Unregister selection as MCP servers') {
            const reg = context.globalState.get('registry') as { [key: string]: RegisteredPrompt };
            let unregistered = 0;
            for (const item of input.selectedItems) {
                reg[item.tag].mcp = false;
                unregistered++;
            }
            vscode.window.showInformationMessage(`Unregistered ${unregistered} prompts as MCP servers`);
            await context.globalState.update('registry', reg);
            await refreshItems();
        }
    });
    input.show();
}

export const convertRefInputToURI = (ref: string): vscode.Uri => {
    // Ref is a git ref
    if (ref.match(/^.*:.*\/$/)) {
        let [provider, rest] = ref.split(':');
        let [owner, rest2] = rest.split('/');
        let [repo, path] = rest2.split('?path=');
        return vscode.Uri.parse(`https://${provider}.com/${owner}/${repo}/blob/main/${path}`);
    }
    // Local path
    try {
        return vscode.Uri.file(ref);
    } catch (e) {
        throw new Error(`Invalid reference: ${ref}`);
    }
}

export const registerPrompt = (context: vscode.ExtensionContext, ref: string, tag: string) => {
    const registry = context.globalState.get('registry') as { [key: string]: RegisteredPrompt };
    registry[tag] = { label: tag, ref: ref.toString(), mcp: false, tag };
    context.globalState.update('registry', registry);
}

export const registerOpenPrompt = async (context: vscode.ExtensionContext) => {
    // If no open markdown editor, return
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') {
        return;
    }
    // If open markdown editor, get the tag from the file name
    const markdownPath = editor.document.uri.fsPath;
    const tag = path.basename(markdownPath);
    const registry = await context.globalState.get('registry') as { [key: string]: RegisteredPrompt };
    if (registry[tag]) {
        if (registry[tag].ref === markdownPath) {
            const option = await vscode.window.showErrorMessage(`You have already registered this prompt.`, 'Open', 'Unregister');
            if (option === 'Open') {
                return vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(registry[tag].ref));
            }
            if (option === 'Unregister') {
                delete registry[tag];
                await context.globalState.update('registry', registry);
                return vscode.window.showInformationMessage(`Unregistered prompt ${tag}`);
            }
        }
        else {
            return vscode.window.showErrorMessage(`Prompt ${tag} already registered at ${registry[tag].ref}`);
        }

    }
    registerPrompt(context, markdownPath, tag);
    return vscode.window.showInformationMessage(`Registered prompt ${tag}`);
}

/**
 * TODO Q's:
 * Default MCP servers?
 * Update to new version migration?
 * Two commands or one command? Registry vs MCP
 * Local ref == path?
 * Ref conversions?
 * Language + Copy --> MCP debugging
 * Connecting to anthropic config?
 * 
 */