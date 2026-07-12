import torch
import torch.nn as nn
from torch_geometric.nn import SAGEConv
import torch.nn.functional as F

class FloodPIGNN(nn.Module):
    """
    Physics-Informed Graph Neural Network (PIGNN) for Flood Prediction.
    Architecture predicts: [Flood Height (h), Velocity X (u), Velocity Y (v)]
    """
    def __init__(self, num_node_features: int, hidden_dim: int = 64):
        super(FloodPIGNN, self).__init__()
        
        # Message passing layers to propagate fluid dynamics downstream
        self.conv1 = SAGEConv(num_node_features, hidden_dim)
        self.conv2 = SAGEConv(hidden_dim, hidden_dim)
        self.conv3 = SAGEConv(hidden_dim, hidden_dim)
        
        # Multi-task output: h, u, v
        self.out_layer = nn.Linear(hidden_dim, 3)

    def forward(self, x, edge_index):
        # Node embeddings through GraphSAGE
        x = self.conv1(x, edge_index)
        x = F.relu(x)
        x = F.dropout(x, p=0.2, training=self.training)
        
        x = self.conv2(x, edge_index)
        x = F.relu(x)
        
        x = self.conv3(x, edge_index)
        x = F.relu(x)
        
        out = self.out_layer(x)
        
        # Constraints: Flood height (h) cannot be strictly negative
        h = F.relu(out[:, 0]).unsqueeze(1)
        u = out[:, 1].unsqueeze(1)
        v = out[:, 2].unsqueeze(1)
        
        return torch.cat([h, u, v], dim=1)

def physics_informed_loss(predictions, targets, edge_index, edge_attr=None, alpha=1.0, beta=0.5):
    """
    Custom Loss Function penalizing violations of the 2D Saint-Venant (Shallow Water) equations.
    
    alpha: Weight for standard MSE regression
    beta: Weight for PDE physics violations
    """
    # 1. Standard Regression Loss (Data)
    mse_loss = F.mse_loss(predictions, targets)
    
    h = predictions[:, 0]
    u = predictions[:, 1]
    v = predictions[:, 2]
    
    source, target = edge_index
    
    # 2. Mass Conservation (Continuity Eq: dh/dt + div(hu) = 0)
    # We approximate divergence over the graph using edge fluxes.
    flux_u = h[source] * u[source] - h[target] * u[target]
    flux_v = h[source] * v[source] - h[target] * v[target]
    
    net_flux = torch.zeros_like(h)
    net_flux.scatter_add_(0, target, flux_u + flux_v) 
    
    mass_loss = torch.mean(net_flux ** 2)
    
    # 3. Momentum Conservation (Gravity & Manning's Friction Proxy)
    # Water flowing uphill against gravity without pressure head is penalized.
    momentum_loss = 0.0
    if edge_attr is not None:
        elev_diff = edge_attr[:, 0] # Assume edge_attr[0] is (target_z - source_z)
        flow_mag = torch.sqrt(u[source]**2 + v[source]**2)
        # Penalize if elev_diff > 0 (uphill) AND flow_mag > 0
        uphill_violation = F.relu(elev_diff) * flow_mag
        momentum_loss = torch.mean(uphill_violation ** 2)
        
    physics_loss = mass_loss + momentum_loss
    
    return alpha * mse_loss + beta * physics_loss
