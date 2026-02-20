import type { DesignGenerateInput, DesignGenerateOutput, UiSchema } from '../schemas/generated.js';

export async function handle(input: DesignGenerateInput): Promise<DesignGenerateOutput> {
    const tree: UiSchema = {
        version: '1.0.0',
        dsVersion: '1.0.0',
        theme: input.options?.theme || 'light',
        screens: [
            {
                id: 'screen_1',
                component: 'Stack',
                children: [
                    {
                        id: 'text_1',
                        component: 'Text',
                        props: {
                            content: 'Generated from Stage 1 Research Context',
                        },
                    },
                ],
            },
        ],
    };

    return {
        status: 'ok',
        tree,
    };
}
