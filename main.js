import Graph from 'graphology';
import { betweenness } from 'graphology-metrics/centrality';
import eigenvector from 'graphology-metrics/centrality/eigenvector';
import louvain from 'graphology-communities-louvain';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import Sigma from 'sigma';
import nlp from 'compromise';

// Get references to UI elements
const analyzeButton = document.querySelector('#analyzeBtn');
const exportButton = document.querySelector('#exportBtn');
const resetButton = document.querySelector('#resetBtn');
const textInput = document.querySelector('#textInput');
const stopwordsInput = document.querySelector('#stopwordsInput');
const centralitySelect = document.querySelector('#centralitySelect');
const legend = document.getElementById('legend');
const graphContainer = document.getElementById('graph-container');

let renderer;
let communityColors = {};
let graphData = {};
let graph;

// Event listeners
analyzeButton.addEventListener('click', () => {
  const text = textInput.value;
  const customStopwords = stopwordsInput.value;
  const centralityType = centralitySelect.value;

  if (!text) {
    alert('Please enter text!');
    return;
  }

  const cleanText = cleanAndNormalizeText(text, customStopwords);
  graph = generateGraph(cleanText, centralityType);
  visualizeGraph(graph);
  updateLegend();
  graphData = exportGraphData(graph);
});

exportButton.addEventListener('click', () => {
  if (!graphData.nodes || !graphData.edges) {
    alert('No graph data to export!');
    return;
  }

  const dataStr = JSON.stringify(graphData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = 'graph-data.json';
  downloadLink.click();
});

resetButton.addEventListener('click', () => {
  visualizeGraph(graph);
});

// Text cleaning and normalization
function cleanAndNormalizeText(text, customStopwords) {
  let doc = nlp(text).normalize({ punctuation: true });
  doc = doc.not('#Value').not('#PhoneNumber').not('#Person');

  if (customStopwords) {
    const stopwords = customStopwords.split(',').map(word => word.trim());
    stopwords.forEach((stopword) => {
      doc = doc.not(stopword);
    });
  }

  return doc.out('text').toLowerCase().replace(/\(|\)|\{|\}|\r|\n|,|\.|"|'|\d/g, '');
}

// Generate the graph with selected centrality
function generateGraph(text, centralityType) {
  const graph = new Graph({ multi: true });
  const words = text.split(' ').filter(Boolean);

  words.forEach((word, index) => {
    if (!graph.hasNode(word)) {
      graph.addNode(word, {
        label: word,
        x: Math.random() * 1000,
        y: Math.random() * 1000,
        size: 5
      });
    }
    if (index < words.length - 1) {
      const nextWord = words[index + 1];
      if (!graph.hasNode(nextWord)) {
        graph.addNode(nextWord, {
          label: nextWord,
          x: Math.random() * 1000,
          y: Math.random() * 1000,
          size: 5
        });
      }
      if (!graph.hasEdge(word, nextWord)) {
        graph.addEdge(word, nextWord);
      }
    }
  });

  let centrality;
  if (centralityType === 'betweenness') {
    centrality = betweenness(graph);
  } else if (centralityType === 'eigenvector') {
    centrality = eigenvector(graph);
  }

  graph.forEachNode((node) => {
    const centralityScore = centrality[node];
    graph.setNodeAttribute(node, 'size', centralityScore * 10 + 5);
  });

  const communities = louvain(graph);
  graph.forEachNode((node) => {
    graph.setNodeAttribute(node, 'community', communities[node]);
  });

  forceAtlas2.assign(graph, { iterations: 100 });

  return graph;
}

// Visualize the graph with Sigma.js
function visualizeGraph(graph) {
  graphContainer.innerHTML = '';
  
  communityColors = {};
  graph.forEachNode((node, attributes) => {
    const community = attributes.community;
    if (!communityColors[community]) {
      communityColors[community] = '#' + Math.floor(Math.random() * 16777215).toString(16);
    }
    graph.setNodeAttribute(node, 'color', communityColors[community]);
  });

  const filteredGraph = new Graph();
  graph.forEachNode((node, attributes) => {
    filteredGraph.addNode(node, attributes);
  });

  graph.forEachEdge((edge, attributes, source, target) => {
    if (filteredGraph.hasNode(source) && filteredGraph.hasNode(target)) {
      filteredGraph.addEdge(source, target, attributes);
    }
  });

  if (renderer) renderer.kill();
  renderer = new Sigma(filteredGraph, graphContainer);

  let tooltip = null;

  renderer.on('enterNode', (event) => {
    const nodeId = event.node;
    const nodeAttributes = graph.getNodeAttributes(nodeId);

    if (tooltip) {
      tooltip.remove();
    }

    tooltip = document.createElement('div');
    tooltip.className = 'node-tooltip';
    tooltip.style.position = 'absolute';
    tooltip.style.background = '#fff';
    tooltip.style.border = '1px solid #ccc';
    tooltip.style.padding = '5px';
    tooltip.style.zIndex = 1000;

    tooltip.innerHTML = `
      <strong>${nodeAttributes.label}</strong><br/>
      Community: ${nodeAttributes.community}<br/>
      Centrality: ${nodeAttributes.size / 10}
    `;

    document.body.appendChild(tooltip);

    const rect = graphContainer.getBoundingClientRect();
    tooltip.style.top = `${rect.top + event.event.y}px`;
    tooltip.style.left = `${rect.left + event.event.x}px`;
  });

  renderer.on('leaveNode', () => {
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }
  });
}

// Update the legend
function updateLegend() {
  legend.innerHTML = '<strong>Communities</strong><br>';
  for (const community in communityColors) {
    legend.innerHTML += `<div style="color:${communityColors[community]};">Community ${community}</div>`;
  }
}

// Export graph data
function exportGraphData(graph) {
  const nodes = [];
  graph.forEachNode((node, attributes) => {
    nodes.push({ id: node, label: attributes.label, size: attributes.size });
  });

  const edges = [];
  graph.forEachEdge((edge, attributes, source, target) => {
    edges.push({ source, target });
  });

  return { nodes, edges };
}
