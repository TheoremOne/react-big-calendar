import PropTypes from 'prop-types';
import React, { Component } from 'react';
import cuid from 'cuid';
import propEq from 'ramda/src/propEq';
import findIndex from 'ramda/src/findIndex';
import splitAt from 'ramda/src/splitAt';
import addDays from 'date-fns/add_days';

import BigCalendar from '../../index';
import { withLevels } from '../../utils/eventLevels';

class DateContentRowWrapper extends Component {
  state = {
    drag: null,
    hover: null,
    hoverData: null,
    hasExitedBackgroundCell: false,
  };

  static contextTypes = {
    onEventReorder: PropTypes.func,
  };

  static childContextTypes = {
    onSegmentDrag: PropTypes.func,
    onSegmentHover: PropTypes.func,
    onSegmentDrop: PropTypes.func,
    onBackgroundCellEnter: PropTypes.func,
    onBackgroundCellHoverExit: PropTypes.func,
  };

  getChildContext() {
    return {
      onSegmentDrag: this.handleSegmentDrag,
      onSegmentHover: this.handleSegmentHover,
      onSegmentDrop: this.handleSegmentDrop,
      onBackgroundCellEnter: this.handleBackgroundCellEnter,
      onBackgroundCellHoverExit: this.handleBackgroundCellHoverExit,
    };
  }

  componentWillMount() {
    const props = withLevels(this.props);
    this.setState({ ...props });
  }

  componentWillReceiveProps(props, _) {
    const next = withLevels(props);
    this.setState({ ...next });
  }

  _posEq = (a, b) => a.left === b.left && a.level === b.level;

  handleSegmentDrag = drag => {
    // TODO: remove and create a CalendarWrapper and set the current drag pos
    // there and also pass it to children via context
    window.RBC_DRAG_POS = drag;
  };

  handleBackgroundCellEnter = value => {
    // NEEDED??
  };

  handleBackgroundCellHoverExit = () => {
    const props = withLevels(this.props);
    this.setState({ hasExitedBackgroundCell: true });
  };

  handleSegmentHover = ({ position: hover, data: hoverData }, dragEvent) => {
    const { type: dragEventType, data: dragData, ...dragRest } = dragEvent;
    let drag = window.RBC_DRAG_POS;
    let { events } = this.props;
    const { insertedOutsideEvent, hasExitedBackgroundCell } = this.state;

    if (!insertedOutsideEvent && dragEventType === 'outsideEvent') {
      // update position based on hover
      const { position: { span } } = dragRest;
      const dragPos = { ...hover, span, level: hover.level + 1 };
      const { id: eventTemplateId, eventTemplateId: id, ...dragDataRest } = dragData;

      // calculate start and end
      const newId = cuid();
      const data = {
        ...dragDataRest,
        id: newId,
        key: newId,
        eventTemplateId,
        locked: false,
        start: hoverData.start,
        end: addDays(hoverData.start, span),
        weight: hoverData.weight - 0.5,
      };

      // update events
      events = [...events, data];

      // sort events
      events.sort(({ weight: a }, { weight: b }) => (a < b ? -1 : 1));

      // recalculate levels
      const levels = withLevels({ ...this.props, events });

      // update drag level
      let nextDragData = null;
      const lvls = levels.levels;
      for (let i = 0, len = lvls.length; i < len; i++) {
        const lvl = lvls[i];
        nextDragData = lvl.find(({ event, ...pos }) => event === data);
        if (nextDragData) break;
      }

      dragPos.level = nextDragData.level;
      window.RBC_DRAG_POS = dragPos;

      return this.setState(prev => ({
        ...levels,
        insertedOutsideEvent: true,
      }));
    }

    if (hasExitedBackgroundCell && drag) {
      drag.level = hover.level + 1;
      window.RBC_DRAG_POS = drag;
      return this.setState({ hasExitedBackgroundCell: false });
    }

    if (this._posEq(drag, hover)) return;

    const { level: dlevel, left: dleft, right: dright, span: dspan } = drag;
    const { level: hlevel, left: hleft, right: hright, span: hspan } = hover;
    let { levels } = this.state;

    // flatten out segments in a single day cell
    const overlappingSeg = ({ left, right }) => {
      return right >= dleft && dright >= left;
    };

    let cellSegs = levels.map(segs => {
      const idx = findIndex(overlappingSeg)(segs);
      if (idx === -1) {
        return { idx };
      }

      const seg = segs[idx];
      return { ...seg, idx, isHidden: false };
    });

    let { idx: didx, ...dseg } = cellSegs[dlevel],
      { idx: hidx, ...hseg } = cellSegs[hlevel];

    // swap events
    dseg.isHidden = true;
    cellSegs[dlevel] = { idx: didx, ...hseg };
    cellSegs[hlevel] = { idx: hidx, ...dseg, level: hlevel };

    // update cell segments
    let nextLevels = [];

    // get overlapping and not overlapping segments ahead of time
    const [overlapping, notOverlapping] = levels[hlevel].reduce(
      (acc, seg) => {
        const isOverlapping = overlappingSeg(seg);
        const [a, b] = acc;
        isOverlapping ? a.push(seg) : b.push(seg);
        return acc;
      },
      [[], []],
    );

    cellSegs.forEach(({ idx, ...seg }, i) => {
      if (idx === -1) {
        nextLevels.push(levels[i]);
        return;
      }

      let lvl = levels[i];
      seg.level = i;
      if (dspan > 1 && dlevel === i) {
        lvl.splice(idx, 1);
        const nextLvl = [...overlapping, ...lvl];
        nextLevels.push(nextLvl);
      } else if (dspan > 1 && hlevel === i) {
        const [head, [_, ...tail]] = splitAt(lvl, hidx);
        const nextLvl = [...head, seg, ...notOverlapping, ...tail];
        nextLevels.push(nextLvl);
      } else if (hspan > 1 && hlevel === i) {
        nextLevels.push([seg]);
      } else {
        lvl[idx] = seg;
        nextLevels.push(lvl);
      }
    });

    window.RBC_DRAG_POS = { ...drag, level: hlevel };

    const e = this.handleEventReorder(dragEvent.data, hoverData);
    e.sort(({ weight: a }, { weight: b }) => (a < b ? -1 : 1));
    levels = withLevels({ ...this.props, events: e }).levels;

    this.setState({
      levels,
      hover,
      hoverData,
    });
  };

  handleEventReorder = (a, b) => {
    const { events } = this.props;
    const index = findIndex(item => item.id === a.id)(events);

    const skew = a.weight > b.weight ? -1 : 1;
    let remainder = Math.ceil(b.weight / 100) * 100 - b.weight;
    remainder = remainder <= 0 ? 100 : remainder;
    a.weight = b.weight + remainder / 2 * skew;

    events[index] = a;

    return events;
  };

  handleSegmentDrop = ({ level, left, right }) => {
    const { levels, hoverData } = this.state;
    const { onEventReorder } = this.context;
    const drag = window.RBC_DRAG_POS;

    if (!hoverData) return;

    const dragSeg = levels[drag.level].find(({ left }) => drag.left === left);

    if (!dragSeg) {
      this.setState({ drag: null, hover: null, hoverData: null });
      return;
    }

    const overlappingSeg = ({ l, r }) => {
      return l <= left && r >= right;
    };
    const dragData = dragSeg.event;
    const events = levels.reduce((acc, row) => {
      const seg = row.find(({ left }) => drag.left === left);
      if (seg) acc.push(seg.event);
      return acc;
    }, []);

    //return draggedData, hoverData, idxa, idxb, segments
    //onEventReorder && onEventReorder(dragData, hoverData, drag.level, level, events);
    onEventReorder && onEventReorder(levels);

    window.RBC_DRAG_POS = null;
    this.setState({ hover: null, hoverData: null });
  };

  render() {
    const DateContentRowWrapper = BigCalendar.components.dateContentRowWrapper;
    const props = { ...this.props, ...this.state };
    return <DateContentRowWrapper {...props}>{this.props.children}</DateContentRowWrapper>;
  }
}

export default DateContentRowWrapper;
