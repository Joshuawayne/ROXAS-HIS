"""
Google Colab Training Script for Physics-Informed Graph Neural Network (PIGNN)
Optimized for NVIDIA T4 / A100 GPUs

Instructions for Colab:
1. Upload this script to your Colab workspace.
2. Install dependencies: !pip install torch-geometric httpx
3. Run: !python train_pignn.py
"""

import os
import torch
import numpy as np
from torch_geometric.data import Data
import torch.optim as optim
from typing import Tuple

# Assume core.pignn is in path, or copy the class here for self-contained Colab
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
try:
    from core.pignn import FloodPIGNN, physics_informed_loss
except ImportError:
    print("WARNING: core.pignn not found. Make sure this script is run from the correct directory.")
    exit(1)

# Hyperparameters
EPOCHS = 500
LR = 0.001
HIDDEN_DIM = 64
NUM_NODE_FEATURES = 6  # Rainfall, Elevation, Slope, Manning's n, Infiltration, Imperviousness
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

def generate_mock_basin_graph(num_nodes: int = 1000) -> Tuple[Data, torch.Tensor]:
    """
    Generates a synthetic spatial graph representing urban drainage for bootstrapping the model.
    In production, this is built from Roxas City shapefiles.
    """
    print(f"Generating synthetic drainage graph with {num_nodes} nodes...")
    
    # Random node features: [Rainfall, Elev, Slope, Manning_n, Infiltration, Imperviousness]
    x = torch.rand((num_nodes, NUM_NODE_FEATURES), dtype=torch.float)
    
    # Handle Edge Cases: Ensure elevation is strictly positive
    x[:, 1] = torch.abs(x[:, 1]) * 100.0  # Elev 0-100m
    
    # Generate random directed edges (downstream flow)
    # For a real graph, we'd use Delaunay triangulation or actual river networks
    source_nodes = torch.randint(0, num_nodes - 10, (num_nodes * 2,))
    target_nodes = source_nodes + torch.randint(1, 10, (num_nodes * 2,))
    edge_index = torch.stack([source_nodes, target_nodes], dim=0)
    
    # Edge attributes: [Elevation Difference]
    elev_diff = x[target_nodes, 1] - x[source_nodes, 1]
    edge_attr = elev_diff.unsqueeze(1)
    
    data = Data(x=x, edge_index=edge_index, edge_attr=edge_attr)
    
    # Mock targets: [h, u, v]
    # Synthetic target generation based on elevation and rainfall
    h_target = x[:, 0] * 2.0 + (100.0 - x[:, 1]) * 0.01 
    u_target = torch.randn(num_nodes)
    v_target = torch.randn(num_nodes)
    y = torch.stack([h_target, u_target, v_target], dim=1)
    
    return data.to(DEVICE), y.to(DEVICE)

def train():
    print(f"--- PIGNN Training Initialization on {DEVICE} ---")
    
    # 1. Prepare Data
    data, targets = generate_mock_basin_graph()
    
    # 2. Initialize Model
    model = FloodPIGNN(num_node_features=NUM_NODE_FEATURES, hidden_dim=HIDDEN_DIM).to(DEVICE)
    optimizer = optim.Adam(model.parameters(), lr=LR, weight_decay=1e-4)
    
    # 3. Training Loop
    model.train()
    for epoch in range(EPOCHS):
        optimizer.zero_grad()
        
        # Forward pass
        predictions = model(data.x, data.edge_index)
        
        # Physics-Informed Loss
        loss = physics_informed_loss(
            predictions=predictions,
            targets=targets,
            edge_index=data.edge_index,
            edge_attr=data.edge_attr,
            alpha=1.0,
            beta=0.5
        )
        
        # Backprop
        loss.backward()
        
        # Gradient clipping to prevent exploding gradients in complex PDE loss
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()
        
        if epoch % 50 == 0:
            print(f"Epoch [{epoch:03d}/{EPOCHS}] - Total Loss: {loss.item():.4f}")
            
    print("--- Training Complete ---")
    
    # Save weights
    os.makedirs('weights', exist_ok=True)
    torch.save(model.state_dict(), 'weights/pignn_roxas_v1.pth')
    print("Weights saved to weights/pignn_roxas_v1.pth")

if __name__ == "__main__":
    train()
