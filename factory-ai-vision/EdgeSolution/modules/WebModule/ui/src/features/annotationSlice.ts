import {
  createSlice,
  createEntityAdapter,
  PayloadAction,
  nanoid,
  ThunkAction,
  Action,
  createSelector,
} from '@reduxjs/toolkit';
import * as R from 'ramda';

import { getImages } from './imageSlice';
import { Annotation, AnnotationState } from './type';
import { State } from '../store/State';
import { Position2D } from '../store/labelingPage/labelingPageTypes';

// * Annotation Functions
export const BoxObj = {
  init(imageId: number = null): Annotation {
    return {
      id: nanoid(),
      image: imageId,
      label: { x1: 0, y1: 0, x2: 0, y2: 0 },
      annotationState: AnnotationState.Empty,
    };
  },
  createWithPoint(p: Position2D, imageId: number) {
    return BoxObj.add(p, BoxObj.init(imageId));
  },
  add({ x, y }, obj) {
    // make the original object immutable, for future history usage
    const newObj = { ...obj };

    if (obj.annotationState === AnnotationState.Empty) {
      newObj.label.x1 = x;
      newObj.label.y1 = y;
      newObj.label.x2 = x; // initialize x2 y2
      newObj.label.y2 = y;
      newObj.annotationState = AnnotationState.P1Added;
    } else if (obj.annotationState === AnnotationState.P1Added) {
      newObj.label.x2 = x;
      newObj.label.y2 = y;
      newObj.annotationState = AnnotationState.Finish;
    }

    return BoxObj.setVerticesToValidValue(newObj);
  },
  setVerticesToInt(obj: Annotation): Annotation {
    const newObj = { ...obj };
    const { x1, y1, x2, y2 } = newObj.label;
    newObj.label = {
      x1: Math.round(x1),
      y1: Math.round(y1),
      x2: Math.round(x2),
      y2: Math.round(y2),
    };
    return newObj;
  },
  setVerticesPointsOrder(obj: Annotation): Annotation {
    const newObj = { ...obj };
    const { x1, y1, x2, y2 } = newObj.label;
    if (x1 > x2) {
      newObj.label.x1 = x2;
      newObj.label.x2 = x1;
    }
    if (y1 > y2) {
      newObj.label.y1 = y2;
      newObj.label.y2 = y1;
    }

    return newObj;
  },
  setVerticesToValidValue(object: Annotation): Annotation {
    return BoxObj.setVerticesPointsOrder(BoxObj.setVerticesToInt(object));
  },
};

const entityAdapter = createEntityAdapter<Annotation>();

const slice = createSlice({
  name: 'label',
  initialState: entityAdapter.getInitialState(),
  reducers: {
    createAnnotation: (state, action: PayloadAction<{ point: Position2D; imageId: number }>) => {
      const { point, imageId } = action.payload;
      const newAnno = BoxObj.createWithPoint(point, imageId);
      entityAdapter.addOne(state, newAnno);
    },
    updateCreatingAnnotation: (state, action: PayloadAction<Position2D>) => {
      const idOfLastAnno = R.last(state.ids);
      const creatingAnnotation = BoxObj.add(action.payload, state.entities[idOfLastAnno]);

      if (creatingAnnotation.annotationState === AnnotationState.Finish) {
        if (
          (creatingAnnotation.label.x1 | 0) === (creatingAnnotation.label.x2 | 0) &&
          (creatingAnnotation.label.y1 | 0) === (creatingAnnotation.label.y2 | 0)
        ) {
          entityAdapter.removeOne(state, idOfLastAnno);
        } else {
          entityAdapter.updateOne(state, { id: idOfLastAnno, changes: creatingAnnotation });
        }
      }
    },
    updateAnnotation: (state, action) => {
      entityAdapter.updateOne(state, action.payload);
    },
    removeAnnotation: entityAdapter.removeOne,
    resetAnnotation: () => entityAdapter.getInitialState(),
  },
  extraReducers: (builder) =>
    builder.addCase(getImages.fulfilled, (state, action) => {
      entityAdapter.setAll(state, action.payload.labels || {});
    }),
});

const { reducer } = slice;
export default reducer;

export const {
  createAnnotation,
  updateCreatingAnnotation,
  updateAnnotation,
  removeAnnotation,
  resetAnnotation,
} = slice.actions;

export const thunkCreateAnnotation = (
  point: Position2D,
): ThunkAction<void, State, unknown, Action<string>> => (dispatch, getState) => {
  const id = getState().labelingPage.selectedImageId;
  dispatch(createAnnotation({ point, imageId: id }));
};

export const { selectAll: selectAllAnno, selectEntities: selectAnnoEntities } = entityAdapter.getSelectors(
  (state: State) => state.annotations,
);

const selectedImageIdSelector = (state: State) => state.labelingPage.selectedImageId;
export const labelPageAnnoSelector = createSelector(
  [selectedImageIdSelector, selectAllAnno],
  (selectedImageId, allAnnos) => allAnnos.filter((anno) => anno.image === selectedImageId),
);
