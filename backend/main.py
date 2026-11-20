from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import Base, engine, get_db
from models import Organization, User, Product
from auth import hash_password, verify_password, create_access_token, get_current_user

Base.metadata.create_all(bind=engine)

app = FastAPI(title="StockFlow MVP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    organization_name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ProductCreate(BaseModel):
    name: str
    sku: str
    description: Optional[str] = None
    quantity_on_hand: int = 0
    cost_price: Optional[float] = None
    selling_price: Optional[float] = None
    low_stock_threshold: Optional[int] = None

class ProductUpdate(ProductCreate):
    pass

class StockAdjust(BaseModel):
    delta: int

class SettingsUpdate(BaseModel):
    default_low_stock_threshold: int

@app.post("/api/auth/signup")
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    org = Organization(name=req.organization_name.strip())
    db.add(org)
    db.flush()

    user = User(email=req.email, password_hash=hash_password(req.password), organization_id=org.id)
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, org.id)
    return {"access_token": token, "user": {"email": user.email, "organization_name": org.name}}

@app.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user.id, user.organization_id)
    return {
        "access_token": token,
        "user": {"email": user.email, "organization_name": user.organization.name},
    }

@app.get("/api/dashboard")
def get_dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = current_user.organization
    products = db.query(Product).filter(Product.organization_id == org.id).all()

    total_products = len(products)
    total_quantity = sum(p.quantity_on_hand for p in products)

    low_stock_items = []
    for p in products:
        threshold = p.low_stock_threshold if p.low_stock_threshold is not None else org.default_low_stock_threshold
        if p.quantity_on_hand <= threshold:
            low_stock_items.append({
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "quantity_on_hand": p.quantity_on_hand,
                "low_stock_threshold": threshold,
            })

    return {
        "organization_name": org.name,
        "total_products": total_products,
        "total_quantity": total_quantity,
        "low_stock_items": low_stock_items,
    }

@app.get("/api/products")
def list_products(
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org = current_user.organization
    q = db.query(Product).filter(Product.organization_id == org.id)
    if search:
        term = f"%{search.strip()}%"
        q = q.filter(or_(Product.name.ilike(term), Product.sku.ilike(term)))
    products = q.order_by(Product.created_at.desc()).all()

    result = []
    for p in products:
        threshold = p.low_stock_threshold if p.low_stock_threshold is not None else org.default_low_stock_threshold
        result.append({
            "id": p.id,
            "name": p.name,
            "sku": p.sku,
            "description": p.description,
            "quantity_on_hand": p.quantity_on_hand,
            "cost_price": p.cost_price,
            "selling_price": p.selling_price,
            "low_stock_threshold": p.low_stock_threshold,
            "is_low_stock": p.quantity_on_hand <= threshold,
            "last_updated_by": p.last_updated_by,
            "updated_at": p.updated_at,
        })
    return result

@app.post("/api/products", status_code=201)
def create_product(req: ProductCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    exists = db.query(Product).filter(
        Product.organization_id == current_user.organization_id,
        Product.sku == req.sku.strip(),
    ).first()
    if exists:
        raise HTTPException(status_code=400, detail="SKU already exists in your organization")

    product = Product(
        **req.model_dump(),
        organization_id=current_user.organization_id,
        last_updated_by=current_user.email,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product

@app.put("/api/products/{product_id}")
def update_product(
    product_id: int,
    req: ProductUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.organization_id == current_user.organization_id,
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if req.sku.strip() != product.sku:
        dup = db.query(Product).filter(
            Product.organization_id == current_user.organization_id,
            Product.sku == req.sku.strip(),
        ).first()
        if dup:
            raise HTTPException(status_code=400, detail="SKU already exists in your organization")

    for k, v in req.model_dump().items():
        setattr(product, k, v)
    product.last_updated_by = current_user.email
    db.commit()
    db.refresh(product)
    return product

@app.patch("/api/products/{product_id}/adjust")
def adjust_stock(
    product_id: int,
    req: StockAdjust,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.organization_id == current_user.organization_id,
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    new_qty = product.quantity_on_hand + req.delta
    if new_qty < 0:
        raise HTTPException(status_code=400, detail="Quantity cannot be negative")
    product.quantity_on_hand = new_qty
    product.last_updated_by = current_user.email
    db.commit()
    db.refresh(product)
    return product

@app.delete("/api/products/{product_id}")
def delete_product(product_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.organization_id == current_user.organization_id,
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    return {"message": "Product deleted"}

@app.get("/api/settings")
def get_settings(current_user: User = Depends(get_current_user)):
    return {"default_low_stock_threshold": current_user.organization.default_low_stock_threshold}

@app.put("/api/settings")
def update_settings(req: SettingsUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if req.default_low_stock_threshold < 0:
        raise HTTPException(status_code=400, detail="Threshold must be 0 or greater")
    org = current_user.organization
    org.default_low_stock_threshold = req.default_low_stock_threshold
    db.commit()
    return {"default_low_stock_threshold": org.default_low_stock_threshold}