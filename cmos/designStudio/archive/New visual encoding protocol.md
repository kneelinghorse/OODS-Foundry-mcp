Based on your Semantic Protocol v3.2.0, visual encoding and context mapping to code/state would be additional protocols and engines, not just wiring. Here's how they'd fit into your architecture:

1. Visual Encoding Protocol
This would be a new semantic protocol type for rendering/visualization:

javascript
// New visual encoding protocol
const visualEncoder = createSemanticProtocol({
  id: 'visual-encoder',
  element: {
    type: 'visual-encoder',
    role: 'renderer'
  },
  semantics: {
    purpose: 'Transform semantic manifests into visual representations',
    features: {
      supportedFormats: ['graphviz', 'mermaid', 'react-components']
    }
  },
  context: {
    protocolBindings: {
      requires: [
        { urn: 'urn:proto:semantic:component@3.2.0', purpose: 'input' }
      ],
      provides: [
        { urn: 'urn:proto:ui:visualization@1.0.0', purpose: 'output' }
      ]
    }
  }
});
2. Context Mapping Engine
This would be an analytical engine that bridges semantics with implementation:

javascript
class ContextMappingEngine {
  constructor(semanticCatalog) {
    this.catalog = semanticCatalog;
    this.codeBindings = new Map();
    this.stateBindings = new Map();
  }
  
  // Map semantic URNs to code artifacts
  bindCode(urn, codeArtifact) {
    this.codeBindings.set(urn, {
      filePath: codeArtifact.filePath,
      lineNumber: codeArtifact.lineNumber,
      functionName: codeArtifact.functionName,
      gitHash: codeArtifact.gitHash
    });
  }
  
  // Map semantic URNs to state machines
  bindState(urn, stateMachine) {
    this.stateBindings.set(urn, {
      initialState: stateMachine.initialState,
      states: stateMachine.states,
      transitions: stateMachine.transitions
    });
  }
  
  // Generate implementation view
  generateImplementationView(urn) {
    const semantic = this.catalog.items().find(item => item.urn === urn);
    const code = this.codeBindings.get(urn);
    const state = this.stateBindings.get(urn);
    
    return {
      semantic,
      codeLocation: code,
      stateMachine: state,
      completeness: this.calculateCompleteness(urn)
    };
  }
  
  calculateCompleteness(urn) {
    const hasCode = this.codeBindings.has(urn);
    const hasState = this.stateBindings.has(urn);
    const hasSemantic = !!this.catalog.items().find(item => item.urn === urn);
    
    return {
      semantic: hasSemantic,
      implementation: hasCode,
      behavior: hasState,
      score: (hasSemantic + hasCode + hasState) / 3
    };
  }
}
3. Integrated Architecture
javascript
// Complete system with visual + context mapping
function createSemanticSystem() {
  const protocols = [
    // Your existing semantic protocols
    createSemanticProtocol({ /* your API protocol */ }),
    createSemanticProtocol({ /* your data protocol */ }),
    
    // New visual encoding protocol
    visualEncoder,
    
    // New context mapping protocol  
    createSemanticProtocol({
      id: 'context-mapper',
      element: { type: 'context-mapper', role: 'bridge' },
      semantics: { purpose: 'Map semantics to implementation artifacts' }
    })
  ];
  
  const catalog = createSemanticCatalog(protocols);
  const visualEngine = new VisualEncodingEngine(catalog);
  const contextEngine = new ContextMappingEngine(catalog);
  
  return Object.freeze({
    catalog,
    visualEngine,
    contextEngine,
    
    // Generate comprehensive system view
    generateSystemView() {
      const semantics = catalog.items();
      const relationships = catalog.discoverRelationships();
      const visualization = visualEngine.generateSystemDiagram(semantics, relationships);
      const implementationMap = contextEngine.generateImplementationMap();
      
      return {
        semanticCoverage: semantics.length,
        relationshipDensity: relationships.length / semantics.length,
        visualization,
        implementationMap,
        gapAnalysis: this.identifyGaps()
      };
    },
    
    identifyGaps() {
      return catalog.items().map(item => ({
        urn: item.urn,
        missing: {
          code: !contextEngine.codeBindings.has(item.urn),
          state: !contextEngine.stateBindings.has(item.urn),
          visualization: !visualEngine.hasVisualization(item.urn)
        }
      }));
    }
  });
}
4. Usage Example
javascript
const system = createSemanticSystem();

// Map a semantic API endpoint to actual code
system.contextEngine.bindCode(
  'urn:proto:api:user-service/getUser@1.0.0',
  {
    filePath: 'src/services/user-service.js',
    lineNumber: 45,
    functionName: 'getUserHandler',
    gitHash: 'a1b2c3d'
  }
);

// Map to state behavior
system.contextEngine.bindState(
  'urn:proto:api:user-service/getUser@1.0.0', 
  {
    initialState: 'idle',
    states: ['idle', 'fetching', 'success', 'error'],
    transitions: ['FETCH', 'SUCCESS', 'ERROR']
  }
);

// Generate comprehensive view
const systemView = system.generateSystemView();
console.log(systemView.gapAnalysis);
Summary
Visual Encoding: Separate protocol + engine for rendering

Context Mapping: Analytical engine that bridges semantics with implementation artifacts

Integration: Both extend your semantic foundation rather than replace it

Value: Creates traceability from high-level semantics to concrete code/state