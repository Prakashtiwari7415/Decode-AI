import React from 'react';
import { Scene } from '../../types/lesson';
import { ArchitectureScene } from './ArchitectureScene';
import { CodeDiffScene } from './CodeDiffScene';
import { TextConceptScene } from './TextConceptScene';
import { TerminalScene } from './TerminalScene';

interface SceneRendererProps {
  scene: Scene;
}

export const SceneRenderer: React.FC<SceneRendererProps> = ({ scene }) => {
  const { visual, title } = scene;

  switch (visual.scene_type) {
    case 'diagram':
      return <ArchitectureScene visual={visual} title={title} narrationText={scene.narration_text} />;
    case 'code_diff':
      return <CodeDiffScene visual={visual} title={title} />;
    case 'terminal':
      return <TerminalScene visual={visual} title={title} />;
    case 'text':
    case 'comparison':
    default:
      return (
        <TextConceptScene
          visual={visual}
          title={title}
          narrationText={scene.narration_text}
          whatToVerify={scene.what_to_verify}
        />
      );
  }
};
