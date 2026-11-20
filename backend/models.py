from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base

def utcnow():
    return datetime.now(timezone.utc)

class Organization(Base):
    __tablename__ = "organizations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    default_low_stock_threshold = Column(Integer, default=5, nullable=False)
    created_at = Column(DateTime, default=utcnow)

    users = relationship("User", back_populates="organization")
    products = relationship("Product", back_populates="organization")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    created_at = Column(DateTime, default=utcnow)

    organization = relationship("Organization", back_populates="users")

class Product(Base):
    __tablename__ = "products"
    __table_args__ = (UniqueConstraint("organization_id", "sku", name="uq_org_sku"),)

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    sku = Column(String, nullable=False)
    description = Column(String, nullable=True)
    quantity_on_hand = Column(Integer, default=0, nullable=False)
    cost_price = Column(Float, nullable=True)
    selling_price = Column(Float, nullable=True)
    low_stock_threshold = Column(Integer, nullable=True)
    last_updated_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    organization = relationship("Organization", back_populates="products")