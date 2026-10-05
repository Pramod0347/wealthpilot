from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.home_contribution import HomeContribution
from app.schemas.home_contribution import HomeContributionCreate, HomeContributionRead, HomeContributionUpdate

router = APIRouter(prefix="/home-contributions", tags=["home-contributions"])


@router.get("", response_model=list[HomeContributionRead])
def list_home_contributions(db: Session = Depends(get_db)) -> list[HomeContributionRead]:
    return db.scalars(
        select(HomeContribution).order_by(HomeContribution.contribution_date.desc(), HomeContribution.created_at.desc())
    ).all()


@router.post("", response_model=HomeContributionRead, status_code=status.HTTP_201_CREATED)
def create_home_contribution(payload: HomeContributionCreate, db: Session = Depends(get_db)) -> HomeContributionRead:
    contribution = HomeContribution(**payload.model_dump())
    db.add(contribution)
    db.commit()
    db.refresh(contribution)
    return contribution


@router.patch("/{contribution_id}", response_model=HomeContributionRead)
def update_home_contribution(
    contribution_id: int, payload: HomeContributionUpdate, db: Session = Depends(get_db)
) -> HomeContributionRead:
    contribution = db.get(HomeContribution, contribution_id)
    if contribution is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Home contribution not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(contribution, field, value)
    db.commit()
    db.refresh(contribution)
    return contribution


@router.delete("/{contribution_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_home_contribution(contribution_id: int, db: Session = Depends(get_db)) -> None:
    contribution = db.get(HomeContribution, contribution_id)
    if contribution is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Home contribution not found")
    db.delete(contribution)
    db.commit()
